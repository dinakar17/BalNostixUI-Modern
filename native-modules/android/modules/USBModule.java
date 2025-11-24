package com.nostix;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.nostix.usb.usbcom.UsbComManager;

import java.io.IOException;
import java.util.HashMap;

public class USBModule extends ReactContextBaseJavaModule implements LifecycleEventListener{
    UsbManager usbManager;
    HashMap<String, UsbDevice> deviceList;
    UsbDevice usbDevice;
    UsbComManager usbComManager;
    private final ReactContext reactContext;
    BluetoothCustomModule bluetoothCustomModule = new BluetoothCustomModule(getReactApplicationContext());
    String deviceName = "";
    public static final String TAG = "USBModule";
    private static final String INTENT_ACTION_GRANT_USB = "com.example.demouart" + ".GRANT_USB";
    boolean isPermissionGranted = false;

    PendingIntent permissionintent;


    public static BALBTDongleApiImpl balDongleLib;
    USBModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }
    public static BALBTDongleApiImpl getBalDongleLib() {
        return balDongleLib;
    }

    public void setBalDongleLib(BALBTDongleApiImpl balDongleLib) {
        this.balDongleLib = balDongleLib;
    }
    @ReactMethod
    @SuppressLint("MissingPermission")
    @SuppressWarnings("unused")
    public void initBalUSBDongle( String baseURL,Promise promise){
        if (this.balDongleLib != null) {
            Log.i(TAG, "balDongleLib.stop()" );
            this.balDongleLib.stop();
            this.balDongleLib=null;
        }
        Log.i(TAG, "usbComManager.getReadEndPoint() ="+(usbComManager.getReadEndPoint()!=null) +  "usbComManager.getWriteEndPoint() ="+(usbComManager.getWriteEndPoint()!=null));
        this.balDongleLib = new BALBTDongleApiImpl(usbComManager.getUsbConnection(),usbComManager.getReadEndPoint(), usbComManager.getWriteEndPoint());
        //bluetoothCustomModule=this.reactContext.getNativeModule(BluetoothCustomModule);
        bluetoothCustomModule.setBalDongleLib(this.balDongleLib);
        bluetoothCustomModule.subscribeToUpdateUI();
        this.balDongleLib.setClientInfo("BALNostix+ -" + baseURL, BuildConfig.APPLICATION_ID, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE);


        Boolean status = this.balDongleLib.initBTDongleComm(deviceName);
        Log.i(TAG, "initBalUSBDongle : initBTDongleComm:"+status +" USB NAme="+ deviceName);

        try {
            Log.i(TAG, "initBalUSBDongle: this.balDongleLib.isConnected() " + this.balDongleLib.isConnected());
            this.balDongleLib.setPackageDir(reactContext);
            if (this.balDongleLib.isConnected()) {
                promise.resolve(true);
            } else {
                promise.resolve(false);
            }
        } catch (IOException exception) {
            exception.printStackTrace();
            Log.d(TAG, "initBalDongle: " + exception.getMessage());
            promise.resolve(false);
        } catch (Exception exception) {
            exception.printStackTrace();
            Log.d(TAG, "initBalDongle: " + exception.getMessage());
            promise.resolve(false);
        }

    }

    private void getConnectedDevice() {
        //for back press
//        if(usbDevice!=null)
//            usbDevice=null;
        deviceList = usbManager.getDeviceList();
        Log.i(TAG, "getConnectedDevice: ");
        for (UsbDevice device : deviceList.values()) {
            usbDevice = device;
            /*manufacture name= FTDI , Device Name=Kernal hardware address , Product Name= FTDI UART */
            deviceName = usbDevice.getManufacturerName();
        }
    }

    @ReactMethod
    @SuppressLint("MissingPermission")
    @SuppressWarnings("unused")
    public void getPermissionForUSB(Promise promise){
        getConnectedDevice();
       if(usbDevice!=null && permissionintent!=null ){
//           if(usbManager.hasPermission(usbDevice)){
//               WritableMap mapped = Arguments.createMap();
//               mapped.putString("name",usbDevice.getDeviceName());
//               mapped.putString("status", "PermissonAreadyGranted");
//               sendEvent("USBDeviceConnectStatus",mapped);
//               usbDevice=null;
//           }
//           else{
               usbManager.requestPermission(usbDevice, permissionintent);
//           }

       }
    if(usbDevice!=null ){
        Log.i(TAG,"ispermissiongranted true");
            promise.resolve(true);
        }
        else{
        Log.i(TAG,"ispermissiongranted false");
            promise.resolve(false);
        }
    }
    @ReactMethod
    @SuppressLint("MissingPermission")
    @SuppressWarnings("unused")
    public void resetUSBPermission(Promise promise){
       // isPermissionGranted=false;
        if(usbDevice!=null){
            WritableMap mapped = Arguments.createMap();
            mapped.putString("name",usbDevice.getDeviceName());
            mapped.putString("status", "DeviceDetached");
            //sendEvent("USBDeviceConnectStatus",mapped);
            usbDevice=null;
        }
        Log.d(TAG, "resetUSBPermission" );
    }
    private final BroadcastReceiver USBDeviceListerner = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            Log.d(TAG, "Intent Filter Action: " + action);
            if (INTENT_ACTION_GRANT_USB.equals(action) ) {
                //&& !isPermissionGranted
                synchronized (this) {
                    Log.i(TAG, "permission recieved: ->");
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        try {
                            isPermissionGranted = true;
                            usbComManager.connectDevice(usbDevice);
                            if (usbDevice != null && (!usbDevice.getManufacturerName().equals(""))){
                                Log.i(TAG, "permission recieved: (usbDevice!=null->" + usbDevice.getVendorId());

                                WritableMap mapped = Arguments.createMap();
                                mapped.putString("name", deviceName);
                                mapped.putString("status", "success");
                                sendEvent("USBDeviceConnectStatus",mapped);
                            }
                        } catch (IOException e) {
                            Log.i(TAG, "detached catch");
                            throw new RuntimeException(e);
                        }
                    }
                }
            }
            else if (action.equals(usbManager.ACTION_USB_DEVICE_DETACHED)) {
                if(usbDevice!=null){
                    WritableMap mapped = Arguments.createMap();
                    mapped.putString("name",usbDevice.getDeviceName());
                    mapped.putString("status", "DeviceDetached");
                    sendEvent("USBDeviceConnectStatus",mapped);
                    usbDevice=null;
                    isPermissionGranted=false;
                }
                Log.i(TAG, "Device Not Connected: ACTION_USB_DEVICE_DETACHED");
            }else{
                if(usbDevice!=null) {
                    WritableMap mapped = Arguments.createMap();
                    mapped.putString("name", usbDevice.getDeviceName());
                    mapped.putString("status", "PermissionGranted");
                    sendEvent("USBDeviceConnectStatus", mapped);
                    Log.i(TAG, "usb permission already granted");
                }
            }

        }
    };
    @SuppressLint({"MissingPermission", "WrongConstant"})
    @ReactMethod
    @SuppressWarnings("unused")
    public void initUSBCom() {
        try {
            Log.i(TAG, "requestPermissionForUsb: ");
           // if (!isPermissionGranted) {
            usbManager=(UsbManager) reactContext.getSystemService(reactContext.USB_SERVICE);
            usbComManager = new UsbComManager(usbManager, getReactApplicationContext());
                 permissionintent = PendingIntent.getBroadcast(reactContext, 0, new Intent(INTENT_ACTION_GRANT_USB), PendingIntent.FLAG_MUTABLE);
                IntentFilter filter = new IntentFilter(INTENT_ACTION_GRANT_USB);
            filter.addAction(usbManager.ACTION_USB_DEVICE_ATTACHED);
            filter.addAction(usbManager.ACTION_USB_DEVICE_DETACHED);
                    reactContext.registerReceiver(USBDeviceListerner, filter);
        } catch (Exception e) {
            e.printStackTrace();
        }

    }
    private void sendEvent(String eventName, WritableMap body) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, body);
        } else {
            Log.e(TAG, "There is currently no active Catalyst instance");
        }
    }
    @Override
    public void onHostResume() {

    }

    @Override
    public void onHostPause() {

    }

    @Override
    public void onHostDestroy() {

         reactContext.unregisterReceiver(USBDeviceListerner);
    }

    // Required methods for NativeEventEmitter
    @ReactMethod
    public void addListener(String eventName) {
        // Keep: Required for RN built-in Event Emitter support
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Keep: Required for RN built-in Event Emitter support
    }

    @NonNull
    @Override
    public String getName() {
        return "USBModule";
    }
}
