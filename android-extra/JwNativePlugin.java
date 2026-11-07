package com.aldair.jwprograma;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Guardar ficheiros nas Transferências e tela cheia. */
@CapacitorPlugin(name = "JwNative")
public class JwNativePlugin extends Plugin {

    @PluginMethod
    public void saveDownload(PluginCall call) {
        final String name = call.getString("name", "ficheiro");
        final String mime = call.getString("mime", "application/octet-stream");
        final String data = call.getString("data", "");
        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver cr = getContext().getContentResolver();
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (u == null) { call.reject("sem destino"); return; }
                    try (OutputStream os = cr.openOutputStream(u)) { os.write(bytes); }
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    dir.mkdirs();
                    try (FileOutputStream os = new FileOutputStream(new File(dir, name))) { os.write(bytes); }
                }
                JSObject o = new JSObject();
                o.put("ok", true);
                call.resolve(o);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    /* cores da janela e das barras: iguais ao fundo da app, para não aparecer nenhuma faixa */
    private void paint(Window w, String bg, boolean on) {
        try {
            int cor = 0xFF1E3A8A;
            if (bg != null && bg.length() > 0) cor = Color.parseColor(bg);
            if (on) {
                w.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
                w.setBackgroundDrawable(new ColorDrawable(cor));
                w.setNavigationBarColor(Color.TRANSPARENT);
                w.setStatusBarColor(Color.TRANSPARENT);
                if (Build.VERSION.SDK_INT >= 29) w.setNavigationBarContrastEnforced(false);
            } else {
                w.clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
                w.setBackgroundDrawable(new ColorDrawable(0xFF1E3A8A));
                w.setStatusBarColor(0xFF1E3A8A);
            }
        } catch (Exception ignored) { }
    }

    @PluginMethod
    public void setWindowColor(PluginCall call) {
        final String bg = call.getString("bg", "");
        getActivity().runOnUiThread(() -> paint(getActivity().getWindow(), bg, true));
        call.resolve();
    }

    @PluginMethod
    public void setFullscreen(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        final String bg = call.getString("bg", "");
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                View decor = w.getDecorView();
                paint(w, bg, on);
                if (Build.VERSION.SDK_INT >= 28) {
                    WindowManager.LayoutParams lp = w.getAttributes();
                    lp.layoutInDisplayCutoutMode = on
                        ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                        : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
                    w.setAttributes(lp);
                }
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, decor);
                if (on) {
                    /* a app desenha por baixo das barras e do entalhe: nenhuma faixa fica por cobrir */
                    WindowCompat.setDecorFitsSystemWindows(w, false);
                    ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
                        /* com o teclado aberto, a app sobe para o campo de texto continuar visível */
                        int ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
                        v.setPadding(0, 0, 0, insets.isVisible(WindowInsetsCompat.Type.ime()) ? ime : 0);
                        return insets;
                    });
                    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    c.hide(WindowInsetsCompat.Type.systemBars());
                } else {
                    c.show(WindowInsetsCompat.Type.systemBars());
                    ViewCompat.setOnApplyWindowInsetsListener(decor, null);
                    decor.setPadding(0, 0, 0, 0);
                    WindowCompat.setDecorFitsSystemWindows(w, true);
                }
                ViewCompat.requestApplyInsets(decor);
                /* altura da zona do topo (entalhe/barra de estado), em px CSS, para o cabeçalho não ficar por baixo */
                float d = getContext().getResources().getDisplayMetrics().density;
                WindowInsetsCompat ri = ViewCompat.getRootWindowInsets(decor);
                int top = 0;
                if (ri != null) {
                    top = Math.max(
                        ri.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.statusBars()).top,
                        ri.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.displayCutout()).top);
                }
                if (top == 0) {
                    int id = getContext().getResources().getIdentifier("status_bar_height", "dimen", "android");
                    if (id > 0) top = getContext().getResources().getDimensionPixelSize(id);
                }
                JSObject o = new JSObject();
                o.put("top", Math.round(top / d));
                call.resolve(o);
            } catch (Exception e) {
                call.resolve();
            }
        });
    }
}
