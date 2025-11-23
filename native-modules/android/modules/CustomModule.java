package com.nostix;


import android.os.Build;
import android.os.FileUtils;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;


public class CustomModule extends ReactContextBaseJavaModule {

    private final ReactContext reactContext;

    CustomModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @NonNull
    @Override
    public String getName() {
        return "TestModule";
    }


    @RequiresApi(api = Build.VERSION_CODES.Q)
    private void copyFile(File source, File destination) throws IOException {
        FileUtils.copy(new FileInputStream(source), new FileOutputStream(destination));
    }

    private void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory()) for (File child : fileOrDirectory.listFiles()) {
            child.delete();
            deleteRecursive(child);
        }
        fileOrDirectory.delete();
    }

    @ReactMethod
    @RequiresApi(api = Build.VERSION_CODES.Q)
    @SuppressWarnings("unused")
    public void copyFilesToLocation(String sourcePath, Promise promise) {
        try {
            File source = new File(sourcePath);
            String destinationPath = getReactApplicationContext().getDataDir().toString() + "/balDownload";
            Log.d("From native side", sourcePath + destinationPath);
            Log.d("Files", "Path: " + sourcePath);
            File sourceDirectory = new File(sourcePath);
            File[] files = sourceDirectory.listFiles();
            Log.d("Files", "Size: " + files.length);
            File destinationDirectory = new File(destinationPath);
            if (destinationDirectory.exists()) {
                deleteRecursive(destinationDirectory);
            }
            destinationDirectory.mkdir();
            for (int i = 0; i < files.length; i++) {
                Log.d("Files", "FileName:" + files[i].getName());
                File destination = new File(destinationPath + "/" + files[i].getName());
                copyFile(files[i], destination);
            }
            promise.resolve(true);
        } catch (IOException exception) {
            Log.d("From native side", exception.getMessage());
            promise.resolve(false);
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getAndroidID(Promise promise) {
        try {
            String android_id = Settings.Secure.getString(reactContext.getContentResolver(), Settings.Secure.ANDROID_ID);
            promise.resolve(android_id);
        } catch (Exception e) {
            promise.reject("100", "Something went wrong");
        }
    }
}
