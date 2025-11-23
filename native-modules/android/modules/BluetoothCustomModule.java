package com.nostix;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import android.os.CountDownTimer;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.Observer;

import com.bal.balnostix.base.ECURecord;
import com.bal.balnostix.base.ErrorCodeModel;
import com.bal.balnostix.base.FlashingUpdateModel;
import com.bal.balnostix.base.utils.BtDongleVersionInfo;
import com.bal.balnostix.base.ReadParameterModel;
import com.bal.balnostix.base.utils.xmlparse.Routine;
import com.bal.balnostix.dongle.utils.BLog;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.nostix.device.NativeDevice;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import java.util.ArrayList;

import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Timer;
import java.util.UUID;

public class BluetoothCustomModule extends ReactContextBaseJavaModule implements LifecycleEventListener {

    private static final long FIFTEEN_MINUTE_IN_MILLISECONDS = 900000;

    private static final long ONE_MINUTE_IN_MILLISECONDS = 60000;
    private static final long DEFAULT_TIMEOUT_FOR_FLASHING = 6000;// 45000;
    private static Integer UPDATE_FRAMES_TIME = 720;// 60;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final String btUUID = "00001101-0000-1000-8000-00805F9B34FB";
    private final ReactContext reactContext;
    private final String TAG = "BluetoothCustomModule";
    private final String PARSING_COMPLETE_TAG = "{\"status\":true,\"value\":\"Completed Parsing\"}";
    private final String STARTED_PARSING_TAG = "{\"status\":true,\"value\":\"Started Parsing\"}";
    private final String PARSING_INPROGRESS_TAG = "{\"status\":true,\"value\":\"Parsing in Progress\"}";
    private boolean isUpdatePerFrame;

    public BALBTDongleApiImpl getBalDongleLib() {
        Log.d(TAG, "getBalDongleLib: " + balDongleLib);
        Log.d(TAG, "BalDongleLibVersion: " + balDongleLib.getVersionInfo());
        return balDongleLib;
    }

    public void setBalDongleLib(BALBTDongleApiImpl balDongleLib) {
        this.balDongleLib = balDongleLib;
    }

    public BALBTDongleApiImpl balDongleLib;
    public Observer<ArrayList<ErrorCodeModel>> errorCodesListObserver = new Observer<ArrayList<ErrorCodeModel>>() {
        @Override
        public void onChanged(ArrayList<ErrorCodeModel> errorCodeModels) {
            try {
                WritableArray errorCodeArray = new WritableNativeArray();
                ArrayList<ErrorCodeModel> tempErrorCodeModels;
                if (errorCodeModels != null) {
                    tempErrorCodeModels = (ArrayList) errorCodeModels.clone();
                    for (ErrorCodeModel errorCode : tempErrorCodeModels) {
                        WritableMap errorCodeMap = new WritableNativeMap();
                        errorCodeMap.putString("name", errorCode.getFaultName());
                        errorCodeMap.putString("text", errorCode.getCode());
                        errorCodeMap.putString("description", errorCode.getDesc());
                        errorCodeMap.putString("status", errorCode.getStatus());
                        errorCodeMap.putString("remedy", errorCode.getDtcRemedy());
                        errorCodeArray.pushMap(errorCodeMap);
                    }
                    onChangeLiveDataSendEvent("getErrorCodes", errorCodeArray);
                } else {
                    onChangeLiveDataSendEvent("getErrorCodes", "Error_Out");
                }
            } catch (Exception error) {
                onChangeLiveDataSendEvent("getErrorCodes", "Error_Out");
            }

        }
    };
    public Observer<String> analyticsGraphObserver = new Observer<String>() {
        @Override
        public void onChanged(String analytics) {
            if (analytics != null) {
                onChangeLiveDataSendEvent("analytics", analytics);
            } else {
                onChangeLiveDataSendEvent("analytics", "null");
            }
        }
    };
    public Observer<String> updateBootObserver = new Observer<String>() {
        @Override
        public void onChanged(String updateBoot) {
            if (updateBoot != null) {
                onChangeLiveDataSendEvent("updateBoot", updateBoot);
            } else {
                onChangeLiveDataSendEvent("updateBoot", "null");
            }
        }
    };
    public Observer<String> readVinObserver = new Observer<String>() {
        @Override
        public void onChanged(String vinNumber) {
            if (vinNumber != null) {
                onChangeLiveDataSendEvent("readVin", vinNumber);
            } else {
                onChangeLiveDataSendEvent("readVin", "null");
            }
        }
    };
    public Observer<String> clearCodesObserver = new Observer<String>() {
        @Override
        public void onChanged(String s) {
            if (s != null) {
                onChangeLiveDataSendEvent("clearCode", s);
            } else {
                onChangeLiveDataSendEvent("clearCode", "null");
            }
        }
    };
    public Observer<String> updateUIObserver = new Observer<String>() {

        @Override
        public void onChanged(String response) {
            if (response != null) {
                Log.d(TAG, "subscribeToUpdateUI: " + response);
                onChangeLiveDataSendEvent("updateUI", response);
            } else {
                onChangeLiveDataSendEvent("updateUI", "null");
            }
        }
    };
    // TimerUtils mainTimer = new TimerUtils();
    TimerUtils subTimer = new TimerUtils();
    public Observer<String> dumpObserver = new Observer<String>() {
        @Override
        public void onChanged(String response) {
            subTimer.resetTimer(DEFAULT_TIMEOUT_FOR_FLASHING, "eeDump", false);
            onChangeLiveDataSendEvent("eeDump", response);
        }
    };
    TimerUtilsForActuator actTimer = new TimerUtilsForActuator();
    public Observer<String> actuatorsObserver = new Observer<String>() {
        @Override
        public void onChanged(String s) {
            if (actTimer.isTimerRunning()) {
                actTimer.resetTimer(DEFAULT_TIMEOUT_FOR_FLASHING);
            } else {
                actTimer.startTimer(DEFAULT_TIMEOUT_FOR_FLASHING);
            }
            onChangeLiveDataSendEvent("actuator", s);
        }
    };
    TimerUtilsWith200Mills parsingTimer = new TimerUtilsWith200Mills();
    MutableLiveData testLiveData;
    MutableLiveData tempActLiveData = new MutableLiveData<>();
    private long dynamicWaitTime = 6000;
    private Handler mHandlerForReadParameter;
    private Runnable mStatusCheckerForReadReadParameter;
    private Timer readParameterTimer;
    private Long lastStreamTime = System.currentTimeMillis();// new Date().getTime();
    public Observer<FlashingUpdateModel> writeVinObserver = new Observer<FlashingUpdateModel>() {
        @Override
        public void onChanged(FlashingUpdateModel response) {
            long currentTime = System.currentTimeMillis();// new Date().getTime();
            int millis = (int) Math.abs(currentTime - lastStreamTime);
            if (millis > UPDATE_FRAMES_TIME || response.getPbFlashingMainProgBar() == 100
                    || response.getPbFlashingMainProgBar() == -1 || response.getPbFlashingSubProgBar() == 100
                    || response.getPbFlashingSubProgBar() == -1) {
                subTimer.resetTimer(DEFAULT_TIMEOUT_FOR_FLASHING, "updateWriteVin", false);
                WritableMap progressMap = new WritableNativeMap();
                progressMap.putInt("mainProgress", response.getPbFlashingMainProgBar());
                progressMap.putInt("subProgress", response.getPbFlashingSubProgBar());
                progressMap.putString("status", response.getStatus());
                onChangeLiveDataSendEvent("updateWriteVin", progressMap);
                lastStreamTime = System.currentTimeMillis();// new Date().getTime();
                if (response.getPbFlashingMainProgBar() == -1 || response.getPbFlashingSubProgBar() == -1) {
                    subTimer.stopTimer();
                }
            }
        }
    };
    public Observer<FlashingUpdateModel> writePCObserver = new Observer<FlashingUpdateModel>() {
        @Override
        public void onChanged(FlashingUpdateModel response) {
            long currentTime = System.currentTimeMillis();// new Date().getTime();
            int millis = (int) Math.abs(currentTime - lastStreamTime);
            if (millis > UPDATE_FRAMES_TIME || response.getPbFlashingMainProgBar() == 100
                    || response.getPbFlashingMainProgBar() == -1 || response.getPbFlashingSubProgBar() == 100
                    || response.getPbFlashingSubProgBar() == -1) {
                subTimer.resetTimer(DEFAULT_TIMEOUT_FOR_FLASHING, "updateWritePC", false);
                WritableMap progressMap = new WritableNativeMap();
                progressMap.putInt("mainProgress", response.getPbFlashingMainProgBar());
                progressMap.putInt("subProgress", response.getPbFlashingSubProgBar());
                progressMap.putString("status", response.getStatus());
                onChangeLiveDataSendEvent("updateWritePC", progressMap);
                lastStreamTime = System.currentTimeMillis();// new Date().getTime();
                if (response.getPbFlashingMainProgBar() == -1 || response.getPbFlashingSubProgBar() == -1) {
                    subTimer.stopTimer();
                }
            }
        }
    };
    public Observer<FlashingUpdateModel> writeBinObserver = new Observer<FlashingUpdateModel>() {
        @Override
        public void onChanged(FlashingUpdateModel response) {
            long currentTime = System.currentTimeMillis();// new Date().getTime();
            int millis = (int) Math.abs(currentTime - lastStreamTime);
            if (millis > UPDATE_FRAMES_TIME || response.getPbFlashingMainProgBar() == 100
                    || response.getPbFlashingMainProgBar() == -1 || response.getPbFlashingSubProgBar() == 100
                    || response.getPbFlashingSubProgBar() == -1) {
                subTimer.resetTimer(DEFAULT_TIMEOUT_FOR_FLASHING, "updateWriteBin", false);
                WritableMap progressMap = new WritableNativeMap();
                progressMap.putInt("mainProgress", response.getPbFlashingMainProgBar());
                progressMap.putInt("subProgress", response.getPbFlashingSubProgBar());
                progressMap.putString("status", response.getStatus());
                onChangeLiveDataSendEvent("updateWriteBin", progressMap);
                lastStreamTime = System.currentTimeMillis();// new Date().getTime();
                if (response.getPbFlashingMainProgBar() == -1 || response.getPbFlashingSubProgBar() == -1) {
                    subTimer.stopTimer();
                }
            }
        }
    };
    FlashingUpdateModel responsePrevious;
    public Observer<FlashingUpdateModel> flashObserver = new Observer<FlashingUpdateModel>() {
        @Override
        public void onChanged(FlashingUpdateModel response) {
            long currentTime = System.currentTimeMillis();// new Date().getTime();
            int millis = (int) Math.abs(currentTime - lastStreamTime);
            if (responsePrevious != null && isUpdatePerFrame) {
                if (response.getPbFlashingMainProgBar() != responsePrevious.getPbFlashingMainProgBar()
                        || response.getPbFlashingSubProgBar() != responsePrevious.getPbFlashingSubProgBar()) {
                    millis = millis + 60;
                }

            }
            Log.d(TAG, "Updated on Ui check c:" + response + ",p:" + responsePrevious + ",t:" + millis);
            try {
                responsePrevious = (FlashingUpdateModel) response.clone();
            } catch (Exception e) {
                Log.d(TAG, "Updated on Ui Exception in clone");
            }
            if (millis > UPDATE_FRAMES_TIME || response.getPbFlashingMainProgBar() == 100
                    || response.getPbFlashingSubProgBar() == 100 || response.getPbFlashingSubProgBar() == -1
                    || response.getPbFlashingMainProgBar() == -1) {

                // if (subTimer.isTimerRunning()) {
                subTimer.resetTimer(dynamicWaitTime, "updateFlash", false);
                Log.d(TAG, "Interval timer re-statrted dwt:" + dynamicWaitTime);
                // }
                WritableMap progressMap = new WritableNativeMap();
                progressMap.putInt("mainProgress", response.getPbFlashingMainProgBar());
                progressMap.putInt("subProgress", response.getPbFlashingSubProgBar());
                progressMap.putString("status", response.getStatus());
                onChangeLiveDataSendEvent("updateFlash", progressMap);
                lastStreamTime = System.currentTimeMillis();// new Date().getTime();
                if (response.getPbFlashingMainProgBar() == -1 || response.getPbFlashingSubProgBar() == -1) {
                    stopAllTimer();
                }
            }

        }
    };
    private ECURecord flashingEcuRecord;
    public Observer<FlashingUpdateModel> flashBootObserver = new Observer<FlashingUpdateModel>() {
        @Override
        public void onChanged(FlashingUpdateModel response) {
            long currentTime = System.currentTimeMillis();// new Date().getTime();
            int millis = (int) Math.abs(currentTime - lastStreamTime);

            if (responsePrevious != null && isUpdatePerFrame) {
                if (response.getPbFlashingMainProgBar() != responsePrevious.getPbFlashingMainProgBar()
                        || response.getPbFlashingSubProgBar() != responsePrevious.getPbFlashingSubProgBar()) {
                    millis = millis + 60;
                }
            }
            Log.d(TAG, "BUpdated on Ui check c:" + response + ",p:" + responsePrevious + ",t:" + millis);
            try {
                responsePrevious = (FlashingUpdateModel) response.clone();
            } catch (Exception e) {
                Log.d(TAG, "BUpdated on Ui Exception in clone");
            }
            if (millis > UPDATE_FRAMES_TIME || response.getPbFlashingMainProgBar() == 100
                    || response.getPbFlashingSubProgBar() == 100 || response.getPbFlashingSubProgBar() == -1
                    || response.getPbFlashingMainProgBar() == -1) {
                // if (subTimer.isTimerRunning()) {
                subTimer.resetTimer(dynamicWaitTime, "updateBoot", false);
                Log.d(TAG, "Interval timer re-started dwt:" + dynamicWaitTime);
                // }
                WritableMap progressMap = new WritableNativeMap();
                progressMap.putInt("mainProgress", response.getPbFlashingMainProgBar());
                progressMap.putInt("subProgress", response.getPbFlashingSubProgBar());
                progressMap.putString("status", response.getStatus());
                onChangeLiveDataSendEvent("updateBoot", progressMap);
                lastStreamTime = System.currentTimeMillis();// new Date().getTime();
                if (response.getPbFlashingMainProgBar() == -1 || response.getPbFlashingSubProgBar() == -1) {
                    stopAllTimer();
                }
            }

        }
    };
    private BluetoothAdapter mAdapter;
    @SuppressLint("MissingPermission")
    private final BroadcastReceiver bluetoothDeviceListener = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            Log.d(TAG, "Intent Filter Action: " + action);
            if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
                    NativeDevice nativeDevice = new NativeDevice(device);
                    sendEvent("deviceDiscover", nativeDevice.map());
                }
            } else if (BluetoothDevice.ACTION_BOND_STATE_CHANGED.equals(action)) {
                final int state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR);
                if (state == BluetoothDevice.BOND_BONDED) {
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    NativeDevice nativeDevice = new NativeDevice(device);
                    WritableMap mapped = Arguments.createMap();
                    mapped.putString("name", "deviceParing");
                    mapped.putString("status", "success");
                    mapped.putMap("device", nativeDevice.map());
                    sendEvent("bluetoothDeviceStatus", mapped);
                } else if (state == BluetoothDevice.BOND_NONE) {
                    WritableMap mapped = Arguments.createMap();
                    mapped.putString("name", "deviceParing");
                    mapped.putString("status", "failed");
                    sendEvent("bluetoothDeviceStatus", mapped);
                }
            } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                WritableMap mapped = Arguments.createMap();
                mapped.putString("name", "deviceDiscover");
                mapped.putString("status", "completed");
                sendEvent("bluetoothAdapterStatus", mapped);
            } else if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(intent.getAction())) {
                if (mAdapter.getState() == BluetoothAdapter.STATE_OFF) {
                    WritableMap mapped = Arguments.createMap();
                    mapped.putString("name", "deviceBluetoothStatus");
                    mapped.putString("status", "off");
                    sendEvent("bluetoothAdapterStatus", mapped);
                    return;
                }
                if (mAdapter.getState() == BluetoothAdapter.STATE_ON) {
                    WritableMap mapped = Arguments.createMap();
                    mapped.putString("name", "deviceBluetoothStatus");
                    mapped.putString("status", "no");
                    sendEvent("bluetoothAdapterStatus", mapped);
                }
            } else if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                NativeDevice nativeDevice = new NativeDevice(device);
                WritableMap mapped = Arguments.createMap();
                mapped.putString("name", "deviceBluetoothDisconnected");
                mapped.putString("status", "disconnected");
                mapped.putString("deviceName", device.getName());
                Log.d(TAG, "deviceBluetoothDisconnected:" + device.getName());
                sendEvent("bluetoothAdapterStatus", mapped);
            }
        }
    };
    private InputStream mInputStream;
    private OutputStream mOutputStream;
    private LiveData<String> liveDataOfReadVin;
    private LiveData<String> liveDataOfClearCode;
    private LiveData<ArrayList<ErrorCodeModel>> liveDataOfErrorCodeList;
    private LiveData<String> liveDataAnalyticsGraph;
    private LiveData<String> liveDataActuators;
    private LiveData<String> liveDataUpdateBoot;
    private LiveData<FlashingUpdateModel> liveDataBootStatusUpdate;
    private LiveData<String> liveDataUpdateUI;
    private LiveData<FlashingUpdateModel> liveDataFlashing;
    private LiveData<FlashingUpdateModel> liveDataWriteVin;
    private LiveData<FlashingUpdateModel> liveDataWritePC;
    private LiveData<FlashingUpdateModel> liveDataWriteBin;
    private ArrayList<ReadParameterModel> readParameterList;
    private List<ReadParameterModel> writeParameterList;
    private ArrayList<Routine> listActuatorRoutines;

    private LiveData<String> liveDataOfDump;

    BluetoothCustomModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @NonNull
    @Override
    public String getName() {
        return "BluetoothModule";
    }

    @Override
    public Map<String, Object> getConstants() {
        // Log.d(TAG, "getConstants()" + BuildConfig.FMSURL + " " + BuildConfig.FLAVOR_NAME);
        final Map<String, Object> constants = new HashMap<>();
        // constants.put("FMSURL", BuildConfig.FMSURL);
        // constants.put("SAPURL", BuildConfig.SAPURL);
        // constants.put("FLAVOR_NAME", BuildConfig.FLAVOR_NAME);

        return constants;
    }

    private boolean checkBluetoothAdapter() {
        return (mAdapter != null && mAdapter.isEnabled());
    }

    private void initBluetoothAdapter() {
        this.mAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    private void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory())
            for (File child : fileOrDirectory.listFiles()) {
                child.delete();
                deleteRecursive(child);
            }
        fileOrDirectory.delete();
    }

    @ReactMethod
    public void initIntentFilters() {
        try {
            IntentFilter intentFilter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
            intentFilter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
            intentFilter.addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED);
            intentFilter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);
            intentFilter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
            intentFilter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
            intentFilter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECT_REQUESTED);
            reactContext.registerReceiver(bluetoothDeviceListener, intentFilter);
        } catch (Exception e) {
            e.printStackTrace();
        }

    }

    @SuppressLint("MissingPermission")
    private ArrayList<NativeDevice> getBondedNativeDevices() {
        if (!checkBluetoothAdapter()) {
            throw new IllegalStateException("Bluetooth not available");
        } else {
            ArrayList<NativeDevice> nativeDevices = new ArrayList<NativeDevice>();
            for (BluetoothDevice device : mAdapter.getBondedDevices()) {
                NativeDevice nativeDevice = new NativeDevice(device);
                nativeDevices.add(nativeDevice);
            }
            return nativeDevices;
        }
    }

    @SuppressLint("MissingPermission")
    private void scanDevices() {
        if (mAdapter.isDiscovering()) {
            mAdapter.cancelDiscovery();
        }
        mAdapter.startDiscovery();
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void initApplication(Promise promise) {
        initBluetoothAdapter();
        if (checkBluetoothAdapter()) {
            promise.resolve(true);
        } else {
            promise.resolve(false);
        }
    }

    @ReactMethod
    @SuppressLint("MissingPermission")
    @SuppressWarnings("unused")
    public void enableBluetooth() {
        mAdapter.enable();
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getBondedDevices(Promise promise) {
        try {
            ArrayList<NativeDevice> nativeDevices = getBondedNativeDevices();
            Collections.sort(nativeDevices, Comparator.comparing(NativeDevice::getName));
            WritableArray bonded = Arguments.createArray();
            for (NativeDevice device : nativeDevices) {
                bonded.pushMap(device.map());
            }
            promise.resolve(bonded);
        } catch (Exception e) {
            promise.reject("100", "Bluetooth not available");
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getScanDevices(Promise promise) {
        try {
            scanDevices();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("100", "Bluetooth not available");
        }
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    @SuppressWarnings("unused")
    public void stopDiscovery(Promise promise) {
        try {
            if (mAdapter.isDiscovering()) {
                mAdapter.cancelDiscovery();
            }
        } catch (Exception e) {
            Log.d(TAG, "stopDiscovery: " + e);
        }
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    @SuppressWarnings("unused")
    public void createBond(String address, Promise promise) {
        mAdapter.cancelDiscovery();
        try {
            int time = 0;
            BluetoothDevice device = mAdapter.getRemoteDevice(address);
            device.createBond();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("100", "Bluetooth not available");
        }
    }

    @ReactMethod
    @SuppressLint("MissingPermission")
    @SuppressWarnings("unused")
    public void setDataTransferMode(String modeName, Promise promise) {
        Log.i("TAG", "setDataTransferMode name=" + modeName);
        // method will give modename
        if (modeName.contains("USB")) {
            promise.resolve("USB");
        } else if (modeName.contains("Bluetooth")) {
            promise.resolve("Bluetooth");
        }
    }

    @ReactMethod
    @SuppressLint("MissingPermission")
    @SuppressWarnings("unused")
    public void balDongleLibStop() {
        if (this.balDongleLib != null) {
            this.balDongleLib.stop();
            this.balDongleLib = null;
        }
    }

    @ReactMethod
    @SuppressLint("MissingPermission")
    @SuppressWarnings("unused")
    public void initBalDongle(String btAddress, String baseURL, Promise promise) {
        try {
            BluetoothDevice btDevice = mAdapter.getRemoteDevice(btAddress);
            BluetoothSocket bluetoothSocket = btDevice.createRfcommSocketToServiceRecord(UUID.fromString(btUUID));
            Log.i("TAG", "b4 connect");
            if (!bluetoothSocket.isConnected()) {
                Log.i("TAG", "not connect");
                bluetoothSocket.connect();
            }
            Log.i("TAG", "connect");
            this.mInputStream = bluetoothSocket.getInputStream();
            this.mOutputStream = bluetoothSocket.getOutputStream();
            if (this.balDongleLib != null) {
                this.balDongleLib.stop();
                this.balDongleLib = null;
            }
            this.balDongleLib = new BALBTDongleApiImpl(this.mInputStream, this.mOutputStream);
            subscribeToUpdateUI();
            this.balDongleLib.setClientInfo("BALNostix+ -" + baseURL, BuildConfig.APPLICATION_ID,
                    BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE);
            Boolean status = this.balDongleLib.initBTDongleComm(btDevice.getName());
            this.balDongleLib.setPackageDir(reactContext);
            if (this.balDongleLib.isConnected()) {
                Log.i("TAG", "initBalDongle: " + status);
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

    @ReactMethod
    public void initShutDown() {
        if (balDongleLib == null)
            this.balDongleLib = USBModule.getBalDongleLib();
        // by this time we know it phase3 and usb or bt so take action accordingly
        subscribeToUpdateUI();
        Log.d(TAG, "initShutDown  -->: " + this.balDongleLib.isConnected());
        balDongleLib.initShutdown();
    }

    @ReactMethod
    public void startSelfFlash(int pos) {
        if (balDongleLib == null)
            this.balDongleLib = USBModule.getBalDongleLib();
        subscribeToUpdateUI();
        ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
        Log.d(TAG, "startSelfFlash  -->: " + this.balDongleLib.isConnected());
        BLog.i(TAG + " BtDongleVersionInfo=", BtDongleVersionInfo.getBTAppVersion());
        balDongleLib.startSelfFlash(ecuRecord);
    }

    @ReactMethod
    public void checkIsDongleStuckInBoot() {
        if (balDongleLib == null)
            this.balDongleLib = USBModule.getBalDongleLib();
        subscribeToUpdateUI();
        Log.d(TAG, "checkIsDongleStuckInBoot  -->: " + this.balDongleLib.isConnected());
        balDongleLib.checkIsDongleStuckInBoot();
    }

    @ReactMethod
    public void isDonglePhase3(Promise promise) {
        if (balDongleLib == null)
            this.balDongleLib = USBModule.getBalDongleLib();
        Boolean res = balDongleLib.isDonglePhase3();
        Log.d(TAG, "isDonglePhase3  -->: " + this.balDongleLib.isConnected() + "," + res);
        promise.resolve(res);
    }

    @ReactMethod
    public void getDongleVersionInfo(Promise promise) {

        if (balDongleLib == null)
            this.balDongleLib = USBModule.getBalDongleLib();
        Boolean versionCompRes = !BtDongleVersionInfo.isSmallerVersion;
        BLog.i("getDongleVersionInfo = " + versionCompRes);

        promise.resolve(versionCompRes);
    }

    @ReactMethod
    public void getDongleAppVersion(Promise promise) {

        if (balDongleLib == null)
            this.balDongleLib = USBModule.getBalDongleLib();
        String btAppVersion = " (" + BtDongleVersionInfo.getBTAppVersion() + " & "
                + BtDongleVersionInfo.getBTBootLoaderVersion() + ")";
        BLog.i("getDongleVersionInfo = " + btAppVersion);

        promise.resolve(btAppVersion);
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void subscribeToReadVin() {
        try {
            if (balDongleLib == null)
                this.balDongleLib = USBModule.getBalDongleLib();
            Log.d(TAG, "subscribeToReadVin:: " + (balDongleLib != null));
            liveDataOfReadVin = balDongleLib.readVIN();
            if (liveDataOfReadVin == null) {
                throw new NullPointerException("readVIN is throwing null");
            }

            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataOfReadVin.observeForever(readVinObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToReadVin: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToReadVin: " + error.getMessage());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unsubscribeToReadVin() {
        try {
            if (liveDataOfReadVin == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataOfReadVin.hasActiveObservers()) {
                        liveDataOfReadVin.removeObserver(readVinObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unsubscribeToReadVin: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "unsubscribeToReadVin: " + error.getMessage());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void subscribeToClearCode(int pos, String errorCodeType) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            liveDataOfClearCode = balDongleLib.clearErrorCode(ecuRecord, errorCodeType);
            if (liveDataOfClearCode == null) {
                throw new NullPointerException("clearErrorCode method is throwing null");
            }

            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataOfClearCode.observeForever(clearCodesObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToClearCode: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToClearCode: " + error.getMessage());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unsubscribeToClearCode() {
        try {
            if (liveDataOfClearCode == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataOfClearCode.hasActiveObservers()) {
                        liveDataOfClearCode.removeObserver(clearCodesObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unsubscribeToClearCode: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unsubscribeToClearCode: " + e.getMessage());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void subscribeToDump(int pos) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            liveDataOfDump = balDongleLib.startEEDump(ecuRecord);

            if (liveDataOfDump == null) {
                throw new NullPointerException("subscribeToDump method is throwing null");
            }

            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataOfDump.observeForever(dumpObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToDump: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToDump: " + error.getMessage());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unsubscribeToDump() {
        try {
            if (liveDataOfDump == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataOfDump.hasActiveObservers()) {
                        liveDataOfDump.removeObserver(dumpObserver);
                    }
                    // Call stopFlashing after unsubscribing to halt the dumping process if there's any
                    stopFlashing();
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unsubscribeToDump: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unsubscribeToDump: " + e.getMessage());
        }
    }

    // Read BIN Data Related
    private LiveData<String> liveDataOfReadBinData;

    public Observer<String> readBinDataObserver = new Observer<String>() {
        @Override
        public void onChanged(String response) {
            Log.d(TAG, "readBinDataObserver: Response received - " + (response != null ? response.substring(0, Math.min(response.length(), 100)) + "..." : "null"));
            subTimer.resetTimer(DEFAULT_TIMEOUT_FOR_FLASHING, "readBinData", false);
            onChangeLiveDataSendEvent("readBinData", response);
        }
    };

    // Subscribe method for readBinData
    @ReactMethod
    @SuppressWarnings("unused")
    public void subscribeToReadBinData(int posBMS, int posVCU) {
        try {
            Log.d(TAG, "subscribeToReadBinData: Starting BIN data read for BMS pos=" + posBMS + ", VCU pos=" + posVCU);
            ECURecord ecuRecordOfBMS = balDongleLib.getEcuRecord(posBMS);
            ECURecord ecuRecordOfVCU = balDongleLib.getEcuRecord(posVCU);
            
            Log.d(TAG, "subscribeToReadBinData: ECU records retrieved - BMS: " + (ecuRecordOfBMS != null ? ecuRecordOfBMS.getCuName() : "null") + 
                      ", VCU: " + (ecuRecordOfVCU != null ? ecuRecordOfVCU.getCuName() : "null"));
            
            liveDataOfReadBinData = balDongleLib.readBinData(ecuRecordOfBMS, ecuRecordOfVCU);

            if (liveDataOfReadBinData == null) {
                throw new NullPointerException("readBinData method is throwing null");
            }

            Log.d(TAG, "subscribeToReadBinData: LiveData initialized, setting up observer");
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataOfReadBinData.observeForever(readBinDataObserver);
                    Log.d(TAG, "subscribeToReadBinData: Observer attached successfully");
                }
            });
        } catch (NullPointerException e) {
            Log.e(TAG, "subscribeToReadBinData NullPointerException: " + e.getMessage());
        } catch (Exception error) {
            Log.e(TAG, "subscribeToReadBinData Exception: " + error.getMessage());
        }
    }

    // Unsubscribe method for readBinData
    @ReactMethod
    @SuppressWarnings("unused")
    public void unsubscribeToReadBinData() {
        try {
            Log.d(TAG, "unsubscribeToReadBinData: Attempting to unsubscribe from BIN data observer");
            if (liveDataOfReadBinData == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataOfReadBinData.hasActiveObservers()) {
                        liveDataOfReadBinData.removeObserver(readBinDataObserver);
                        Log.d(TAG, "unsubscribeToReadBinData: Observer removed successfully");
                    } else {
                        Log.d(TAG, "unsubscribeToReadBinData: No active observers to remove");
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.e(TAG, "unsubscribeToReadBinData NullPointerException: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "unsubscribeToReadBinData Exception: " + e.getMessage());
        }
    }

    public void subscribeToUpdateUI() {
        unsubscribeToUpdateUI();
        try {
            liveDataUpdateUI = balDongleLib.updateUIDataUpdated();
            if (liveDataUpdateUI == null) {
                throw new NullPointerException("subscribeToUpdateUI method is throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataUpdateUI.observeForever(updateUIObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToUpdateUI: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToUpdateUI: " + error.getMessage());
        }
    }

    public void unsubscribeToUpdateUI() {
        try {
            if (liveDataUpdateUI == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataUpdateUI.hasActiveObservers()) {

                        liveDataUpdateUI.removeObserver(updateUIObserver);

                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unsubscribeToUpdateUI: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unsubscribeToUpdateUI: " + e.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void subscribeToErrorCodesList(int pos) {
        try {
            subscribeToUpdateUI();
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            liveDataOfErrorCodeList = balDongleLib.scanDtcErrorCode(ecuRecord);
            if (liveDataOfErrorCodeList == null) {
                throw new NullPointerException("scanDtcErrorCode method is throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataOfErrorCodeList.observeForever(errorCodesListObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToErrorCodesList: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToErrorCodesList: " + error.getMessage());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unsubscribeToErrorCodesList() {
        try {
            if (liveDataOfErrorCodeList == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataOfErrorCodeList.hasActiveObservers()) {
                        liveDataOfErrorCodeList.removeObserver(errorCodesListObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unsubscribeToErrorCodesList: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unsubscribeToErrorCodesList: " + e.getMessage());
        }

    }

    @ReactMethod
    public void subscribeToAnalyticsGraph() {
        try {
            subscribeToUpdateUI();
            liveDataAnalyticsGraph = balDongleLib.startAnalyticsGraph();
            if (liveDataAnalyticsGraph == null) {
                throw new NullPointerException("startAnalyticsGraph method is throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataAnalyticsGraph.observeForever(analyticsGraphObserver);
                }
            });

        } catch (NullPointerException exception) {
            Log.d(TAG, "subscribeToAnalyticsGraph: " + exception.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToAnalyticsGraph: " + error.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unSubscribeToAnalyticsGraph() {
        try {
            if (liveDataAnalyticsGraph == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataAnalyticsGraph.hasActiveObservers()) {
                        liveDataAnalyticsGraph.removeObserver(analyticsGraphObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unSubscribeToAnalyticsGraph: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unSubscribeToAnalyticsGraph: " + e.getMessage());
        }
    }

    @ReactMethod
    public void getAllActuators(int pos, Promise promise) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            listActuatorRoutines = balDongleLib.displayListActuatorRoutines(ecuRecord);
            WritableArray actuators = new WritableNativeArray();
            for (int i = 0; i < listActuatorRoutines.size(); i++) {
                Routine item = listActuatorRoutines.get(i);
                WritableMap subItem = new WritableNativeMap();
                subItem.putString("id", item.getRoutineID());
                subItem.putString("name", item.getRoutineName());
                if (item.getListSeq() != null) {
                    subItem.putInt("numberOfSteps", item.getListSeq().size());
                    BLog.d(item.getListSeq().toString());
                } else {
                    subItem.putInt("numberOfSteps", 0);
                }
                subItem.putInt("index", i);
                actuators.pushMap(subItem);
            }
            promise.resolve(actuators);
        } catch (Exception e) {
            promise.resolve(new WritableNativeArray());
            Log.d(TAG, "getAllActuators: " + e.getMessage());
        }
    }

    @ReactMethod
    public void subscribeToActuator(int pos, int index) {
        try {
            subscribeToUpdateUI();
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            Routine routine = null;
            routine = listActuatorRoutines.get(index);
            liveDataActuators = balDongleLib.startActuatorRoutines(ecuRecord, routine, index);
            // liveDataActuators = tempActLiveData;
            // BLog.d("liveDataActuators has be init" + liveDataActuators);
            CountDownTimer tempTimer = new CountDownTimer(2000, 100) {
                @Override
                public void onTick(long millisUntilFinished) {
                    tempActLiveData.postValue(
                            "{\"status\":true,\"message\":\"GottheVCU_Vehicle_Identification_Number:MD2B35300MCD04553"
                                    + millisUntilFinished
                                    + "\",\"processStatus\":\"inProgress\",\"RoutinePosOnUI\":0,\"StepNo\":2}");
                    BLog.d("liveDataActuators  onTick" + millisUntilFinished);
                }

                @Override
                public void onFinish() {
                    tempActLiveData.postValue(
                            "{\"status\":true,\"message\":\"GottheVCU_Vehicle_Identification_Number:MD2B35300MCD04553"
                                    + "DONE" + "\",\"processStatus\":\"opopop\",\"RoutinePosOnUI\":0,\"StepNo\":2}");
                    BLog.d("liveDataActuators  onFinish");
                }
            };
            // tempTimer.start();
            if (liveDataActuators == null) {
                throw new NullPointerException("startActuatorRoutines method throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    actTimer.startTimer(DEFAULT_TIMEOUT_FOR_FLASHING);
                    liveDataActuators.observeForever(actuatorsObserver);
                }
            });

        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToActuator: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToActuator: " + error.getMessage());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unSubscribeToActuator() {
        try {
            if (liveDataActuators == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataActuators.hasActiveObservers()) {
                        liveDataActuators.removeObserver(actuatorsObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unSubscribeToActuator: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unSubscribeToActuator: " + e.getMessage());
        }

    }

    @ReactMethod
    public void updateBootLoader() {
        subscribeToUpdateUI();
        balDongleLib.updateBootLoader();
    }

    @ReactMethod
    public void subscribeToUpdateBoot() {
        try {
            subscribeToUpdateUI();
            liveDataUpdateBoot = balDongleLib.updateBootLoader(); // not in use no
            if (liveDataUpdateBoot == null) {
                throw new NullPointerException("updateBootLoader method throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataUpdateBoot.observeForever(updateBootObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToUpdateBoot: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToUpdateBoot: " + error.getMessage());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unSubscribeToUpdateBoot() {
        try {
            if (liveDataUpdateBoot == null) {
                throw new NullPointerException("Thrown Null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataUpdateBoot.hasActiveObservers()) {
                        liveDataUpdateBoot.removeObserver(updateBootObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unSubscribeToUpdateBoot: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unSubscribeToUpdateBoot: " + e.getMessage());
        }

    }

    @ReactMethod
    public void isBootUpdateRequired(int pos, Promise promise) {
        ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
        Boolean res = balDongleLib.isBootUpdateRequired(ecuRecord);
        promise.resolve(res);
    }

    @ReactMethod
    public void subscribeToBootFlashingUpdate(int pos) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            flashingEcuRecord = ecuRecord;
            dynamicWaitTime = ecuRecord.getTimerToWaitForFlashing();
            UPDATE_FRAMES_TIME = ecuRecord.getUpdateFrameTime();
            isUpdatePerFrame = ecuRecord.isUpdatePerFrame();
            Log.d(TAG, "BdynamicWaitTime: " + dynamicWaitTime + ",UPDATE_FRAMES_TIME: " + UPDATE_FRAMES_TIME
                    + ",isUpdatePerFrame:" + isUpdatePerFrame);

            liveDataBootStatusUpdate = balDongleLib.getBootFlashingUpdate(ecuRecord);
            if (liveDataBootStatusUpdate == null) {
                throw new NullPointerException("getBootFlashingUpdate method throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    subTimer.resetTimer(dynamicWaitTime, "updateBoot", false);
                    liveDataBootStatusUpdate.observeForever(flashBootObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToBootFlashingUpdate: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToBootFlashingUpdate: " + error.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unSubscribeToFlashingBoot() {
        try {
            if (liveDataBootStatusUpdate == null) {
                throw new NullPointerException("Thrown null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataBootStatusUpdate.hasActiveObservers()) {
                        liveDataBootStatusUpdate.removeObserver(flashBootObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unSubscribeToFlashingBoot: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unSubscribeToFlashingBoot: " + e.getMessage());
        }

    }

    @ReactMethod
    public void subscribeToFlashingUpdate(int pos) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            dynamicWaitTime = ecuRecord.getTimerToWaitForFlashing();
            UPDATE_FRAMES_TIME = ecuRecord.getUpdateFrameTime();
            isUpdatePerFrame = ecuRecord.isUpdatePerFrame();
            Log.d(TAG, "dynamicWaitTime: " + dynamicWaitTime + ",UPDATE_FRAMES_TIME: " + UPDATE_FRAMES_TIME
                    + ",isUpdatePerFrame:" + isUpdatePerFrame);
            flashingEcuRecord = ecuRecord;
            liveDataFlashing = balDongleLib.getFlashingUpdate(ecuRecord);
            if (liveDataFlashing == null) {
                throw new NullPointerException("getFlashingUpdate method throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    subTimer.resetTimer(dynamicWaitTime, "updateFlash", false);
                    liveDataFlashing.observeForever(flashObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToFlashingUpdate: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToFlashingUpdate: " + error.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unSubscribeToFlashingUpdate() {
        try {
            if (liveDataFlashing == null) {
                throw new NullPointerException("Thrown null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataFlashing.hasActiveObservers()) {
                        liveDataFlashing.removeObserver(flashObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unSubscribeToFlashingBoot: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unSubscribeToFlashingBoot: " + e.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void subscribeToWriteVinUpdate(int pos, String vin) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            liveDataWriteVin = balDongleLib.writeVIN(vin, ecuRecord);
            if (liveDataWriteVin == null) {
                throw new NullPointerException("subscribeToWriteVinUpdate method throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataWriteVin.observeForever(writeVinObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToWriteVinUpdate: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToWriteVinUpdate: " + error.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unSubscribeToWriteVinUpdate() {
        try {
            if (liveDataWriteVin == null) {
                throw new NullPointerException("Thrown null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataWriteVin.hasActiveObservers()) {
                        liveDataWriteVin.removeObserver(writeVinObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unSubscribeToWriteVinUpdate: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unSubscribeToWriteVinUpdate: " + e.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void subscribeToWritePCUpdate(int pos) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            liveDataWritePC = balDongleLib.writeProgConst(ecuRecord);
            if (liveDataWritePC == null) {
                throw new NullPointerException("subscribeToWritePCUpdate method throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataWritePC.observeForever(writePCObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToWritePCUpdate: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToWritePCUpdate: " + error.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unSubscribeToWritePCUpdate() {
        try {
            if (liveDataWritePC == null) {
                throw new NullPointerException("Thrown null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataWritePC.hasActiveObservers()) {
                        liveDataWritePC.removeObserver(writePCObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unSubscribeToWritePCUpdate: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unSubscribeToWritePCUpdate: " + e.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void subscribeToWriteBinUpdate(int pos, String bin) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            liveDataWriteBin = balDongleLib.writeBIN(bin, ecuRecord);
            if (liveDataWriteBin == null) {
                throw new NullPointerException("subscribeToWriteBinUpdate method throwing null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    liveDataWriteBin.observeForever(writeBinObserver);
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "subscribeToWriteBinUpdate: " + e.getMessage());
        } catch (Exception error) {
            Log.d(TAG, "subscribeToWriteBinUpdate: " + error.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void unSubscribeToWriteBinUpdate() {
        try {
            if (liveDataWriteBin == null) {
                throw new NullPointerException("Thrown null");
            }
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (liveDataWriteBin.hasActiveObservers()) {
                        liveDataWriteBin.removeObserver(writeBinObserver);
                    }
                }
            });
        } catch (NullPointerException e) {
            Log.d(TAG, "unSubscribeToWriteBinUpdate: " + e.getMessage());
        } catch (Exception e) {
            Log.d(TAG, "unSubscribeToWriteBinUpdate: " + e.getMessage());
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getEcuRecords(String ecuRecordJson, String vinNumber, Promise promise) {
        try {
            ArrayList<ECURecord> ecuRecordList = balDongleLib.getEcuRecords(ecuRecordJson);
            WritableArray ecuRecordsArray = new WritableNativeArray();
            for (int i = 0; i < ecuRecordList.size(); i++) {
                ECURecord ecuRecord = ecuRecordList.get(i);

                WritableMap ecuRecordItem = new WritableNativeMap();
                if (ecuRecord != null) {
                    ecuRecordItem.putString("ecuName", ecuRecord.getCuName());
                    ecuRecordItem.putInt("index", i);
                    ecuRecordItem.putBoolean("isErrorCodeEnabled", ecuRecord.isDTC());
                    ecuRecordItem.putBoolean("isReadParameterEnabled", ecuRecord.isDID());
                    ecuRecordItem.putBoolean("isWriteParameterEnabled", ecuRecord.isWriteDid());
                    ecuRecordItem.putBoolean("isReprogramEnabled", ecuRecord.isReprograming());
                    ecuRecordItem.putBoolean("isUpdateBootEnabled", ecuRecord.isBootReprograming());
                    ecuRecordItem.putBoolean("isSpecialFunctionEnabled", ecuRecord.isSpecialOperation());
                    ecuRecordItem.putBoolean("isActuatorEnabled", ecuRecord.isActuatorRoutines());
                    ecuRecordItem.putBoolean("isAnalyticsEnabled", ecuRecord.isAnalyticsGraph());
                    ecuRecordItem.putBoolean("isEEDumpOperation", ecuRecord.isEEDumpOperation());
                    ecuRecordItem.putBoolean("isVinWrite", ecuRecord.isVinWrite());
                    ecuRecordItem.putBoolean("isBinWrite", ecuRecord.isBinWrite());
                    ecuRecordItem.putBoolean("isProgConstWriteEnabled", ecuRecord.isProgConstWrite());
                    ecuRecordItem.putBoolean("isUSBPrograming", ecuRecord.isUSBPrograming());
                    ecuRecordItem.putString("appHexUrl", ecuRecord.getAppHexURLLink());
                    ecuRecordItem.putString("didsXmlUrl", ecuRecord.getDidsXmlURLLink());
                    ecuRecordItem.putString("dtcsXmlUrl", ecuRecord.getDtcsXmlURLLink());
                    ecuRecordItem.putString("btlHexUrl", ecuRecord.getBtlHexURLLink());
                    ecuRecordItem.putString("appHexFileName", ecuRecord.getAppHexLink());
                    ecuRecordItem.putString("didsXmlFileName", ecuRecord.getDidsXmlLink());
                    ecuRecordItem.putString("dtcsXmlFileName", ecuRecord.getDtcsXmlLink());
                    ecuRecordItem.putString("btlHexFileName", ecuRecord.getBtlHexLink());
                    ecuRecordItem.putString("oldHexFileName", ecuRecord.getHexFileName());
                    ecuRecordItem.putBoolean("isCheckBIOError", ecuRecord.isCheckBIOError());
                    ecuRecordItem.putString("readParamAutoRefreshShownInGroupName",
                            ecuRecord.isReadParamAutoRefreshShownInGroup());
                    ecuRecordItem.putString("vinNumber", vinNumber);
                    // Motor Related Items
                    ecuRecordItem.putBoolean("isWriteMotorType", ecuRecord.isWriteMotorType());
                    ecuRecordItem.putBoolean("isAutomateMotorType", ecuRecord.isAutomateMotorType());
                    ecuRecordItem.putString("motorTypeId", ecuRecord.getMotorTypeId());
                    ecuRecordItem.putString("mcuOffsetLearnTriggerId", ecuRecord.getMcuOffsetLearnTriggerId());

                    ecuRecordItem.putInt("dynamicWaitTime", ecuRecord.getTimerToWaitForFlashing());
                    ecuRecordItem.putInt("updateFrameTime", ecuRecord.getUpdateFrameTime());
                    ecuRecordItem.putBoolean("isUpdatePerFrame", ecuRecord.isUpdatePerFrame());
                    ecuRecordItem.putBoolean("isShowUpdatePerFrameTime", ecuRecord.isShowUpdatePerFrameTime());
                    ecuRecordItem.putBoolean("isForceEachTimeOA", ecuRecord.isForceEachTimeOA());
                    BLog.i("isForceEachTimeOA = " + ecuRecord.isForceEachTimeOA());
                    ecuRecordsArray.pushMap(ecuRecordItem);
                }
            }
            promise.resolve(ecuRecordsArray);
        } catch (Exception e) {
            Log.d(TAG, "getEcuRecords: " + e);
            promise.reject("100", "Something went wrong");
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getUpdatedEcuRecords(Integer pos, Promise promise) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            WritableMap ecuRecordItem = new WritableNativeMap();
            if (ecuRecord != null) {
                ecuRecordItem.putString("ecuName", ecuRecord.getCuName());
                ecuRecordItem.putInt("index", pos);
                ecuRecordItem.putBoolean("isErrorCodeEnabled", ecuRecord.isDTC());
                ecuRecordItem.putBoolean("isReadParameterEnabled", ecuRecord.isDID());
                ecuRecordItem.putBoolean("isWriteParameterEnabled", ecuRecord.isWriteDid());
                ecuRecordItem.putBoolean("isReprogramEnabled", ecuRecord.isReprograming());
                ecuRecordItem.putBoolean("isUpdateBootEnabled", ecuRecord.isBootReprograming());
                ecuRecordItem.putBoolean("isSpecialFunctionEnabled", ecuRecord.isSpecialOperation());
                ecuRecordItem.putBoolean("isActuatorEnabled", ecuRecord.isActuatorRoutines());
                ecuRecordItem.putBoolean("isAnalyticsEnabled", ecuRecord.isAnalyticsGraph());
                ecuRecordItem.putBoolean("isEEDumpOperation", ecuRecord.isEEDumpOperation());
                ecuRecordItem.putBoolean("isVinWrite", ecuRecord.isVinWrite());
                ecuRecordItem.putBoolean("isBinWrite", ecuRecord.isBinWrite());
                ecuRecordItem.putBoolean("isProgConstWriteEnabled", ecuRecord.isProgConstWrite());
                ecuRecordItem.putBoolean("isUSBPrograming", ecuRecord.isUSBPrograming());
                ecuRecordItem.putString("appHexUrl", ecuRecord.getAppHexURLLink());
                ecuRecordItem.putString("didsXmlUrl", ecuRecord.getDidsXmlURLLink());
                ecuRecordItem.putString("dtcsXmlUrl", ecuRecord.getDtcsXmlURLLink());
                ecuRecordItem.putString("btlHexUrl", ecuRecord.getBtlHexURLLink());
                ecuRecordItem.putString("appHexFileName", ecuRecord.getAppHexLink());
                ecuRecordItem.putString("didsXmlFileName", ecuRecord.getDidsXmlLink());
                ecuRecordItem.putString("dtcsXmlFileName", ecuRecord.getDtcsXmlLink());
                ecuRecordItem.putString("btlHexFileName", ecuRecord.getBtlHexLink());
                ecuRecordItem.putString("oldHexFileName", ecuRecord.getHexFileName());
                ecuRecordItem.putBoolean("isCheckBIOError", ecuRecord.isCheckBIOError());
                ecuRecordItem.putString("readParamAutoRefreshShownInGroupName",
                        ecuRecord.isReadParamAutoRefreshShownInGroup());
                ecuRecordItem.putInt("dynamicWaitTime", ecuRecord.getTimerToWaitForFlashing());
                ecuRecordItem.putInt("updateFrameTime", ecuRecord.getUpdateFrameTime());
                ecuRecordItem.putBoolean("isUpdatePerFrame", ecuRecord.isUpdatePerFrame());
                ecuRecordItem.putBoolean("isShowUpdatePerFrameTime", ecuRecord.isShowUpdatePerFrameTime());
                ecuRecordItem.putBoolean("isForceEachTimeOA", ecuRecord.isForceEachTimeOA());
                Log.i(TAG, "" + ecuRecord.isWriteMotorType());
                // Motor Related Items
                ecuRecordItem.putBoolean("isWriteMotorType", ecuRecord.isWriteMotorType());
                ecuRecordItem.putBoolean("isAutomateMotorType", ecuRecord.isAutomateMotorType());
                ecuRecordItem.putString("motorTypeId", ecuRecord.getMotorTypeId());
                ecuRecordItem.putString("mcuOffsetLearnTriggerId", ecuRecord.getMcuOffsetLearnTriggerId());
            }
            promise.resolve(ecuRecordItem);
        } catch (Exception e) {
            Log.d(TAG, "getEcuRecords: " + e);
            promise.reject("100", "Something went wrong");
        }
    }

    public void setLivedata() {
        testLiveData = new MutableLiveData();
        liveDataUpdateUI = testLiveData;
    }

    public void postLivedata(JSONObject jsonObject) {
        if (Thread.currentThread().getName().toLowerCase().contains("main")) {
            testLiveData.setValue(jsonObject.toString());
        } else {
            testLiveData.postValue(jsonObject.toString());
        }
    }

    @ReactMethod
    public void updateTestLiveData() throws JSONException, InterruptedException {
        for (int i = 0; i < readParameterList.size(); i++) {
            JSONObject json = new JSONObject();
            ReadParameterModel singleReadParameter = readParameterList.get(i);
            json.put("status", true);
            json.put("valueFor", singleReadParameter.Desc);
            String randomVAl = "random" + Math.random();
            singleReadParameter.value = randomVAl;
            json.put("value", randomVAl);
            postLivedata(json);
        }
        JSONObject json = new JSONObject();
        json.put("status", true);
        json.put("valueFor", "UpdateAll");
        testLiveData.setValue(json.toString());
        postLivedata(json);
        Thread.sleep(50);
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getReadParameters(int pos, String groupName) {
        try {
            Log.d(TAG, "getReadParameters: method called");
            subscribeToUpdateUI();
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            readParameterList = balDongleLib.getListOfReadParameter(ecuRecord, groupName);
            // setLivedata();
            // new Thread(new Runnable() {
            // @Override
            // public void run() {
            // try {
            // updateTestLiveData();
            // } catch (Exception e) {
            //
            // }
            // }
            // }).start();
            if (mHandlerForReadParameter != null) {
                mHandlerForReadParameter.removeCallbacks(mStatusCheckerForReadReadParameter);
            }
            mHandlerForReadParameter = new Handler(Looper.getMainLooper());
            mStatusCheckerForReadReadParameter = new Runnable() {
                @Override
                public void run() {
                    getUpdatedReadParameters();
                    mHandlerForReadParameter.postDelayed(this, 450);
                }
            };
            mHandlerForReadParameter.post(mStatusCheckerForReadReadParameter);
        } catch (Exception e) {
            Log.d(TAG, "getReadParameters: " + e);
        }

    }

    public void getUpdatedReadParameters() {
        try {
            WritableArray readParametersArray = new WritableNativeArray();
            ArrayList<ReadParameterModel> tempReadParameterList;
            tempReadParameterList = (ArrayList) readParameterList.clone();
            for (int i = 0; i < tempReadParameterList.size(); i++) {
                ReadParameterModel singleReadParameter = tempReadParameterList.get(i);
                WritableMap readParameter = new WritableNativeMap();
                readParameter.putString("detail", singleReadParameter.value);
                readParameter.putString("name", singleReadParameter.Desc);
                readParametersArray.pushMap(readParameter);
            }
            WritableMap data = new WritableNativeMap();
            data.putArray("data", readParametersArray);
            data.putString("name", "readparameters");
            data.putBoolean("success", true);
            sendEvent("readparameters", data);
        } catch (Exception e) {
            Log.d(TAG, "getUpdatedReadParameters: " + e);
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void stopReadParametersTimer() {
        try {
            if (mHandlerForReadParameter != null) {
                mHandlerForReadParameter.removeCallbacks(mStatusCheckerForReadReadParameter);
            }
        } catch (Exception e) {
            Log.d(TAG, "stopReadParametersTimer: " + e);
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getListOfDidGroups(int pos, Promise promise) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            ArrayList<String> didGroupList = balDongleLib.getDIDGroups(ecuRecord);
            WritableArray didGroupArray = new WritableNativeArray();
            for (int i = 0; i < didGroupList.size(); i++) {
                String singleDidGroupName = didGroupList.get(i);
                didGroupArray.pushString(singleDidGroupName);
            }
            promise.resolve(didGroupArray);
        } catch (Exception e) {
            promise.resolve(new WritableNativeArray());
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void readEcuBasicnfo(int pos) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            balDongleLib.readEcuBasicnfo(ecuRecord);
        } catch (Exception e) {
            Log.d(TAG, "readEcuBasicnfo: " + e);
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getWriteParameter(int pos) {
        try {
            Log.d(TAG, "getWriteParameter: method called");
            subscribeToUpdateUI();
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            writeParameterList = balDongleLib.getWriteParameter(ecuRecord);
            // setLivedata();
            // new Thread(new Runnable() {
            // @Override
            // public void run() {
            // try {
            // updateTestLiveData();
            // } catch (Exception e) {
            //
            // }
            // }
            // }).start();
            if (mHandlerForReadParameter != null) {
                mHandlerForReadParameter.removeCallbacks(mStatusCheckerForReadReadParameter);
            }
            mHandlerForReadParameter = new Handler(Looper.getMainLooper());
            mStatusCheckerForReadReadParameter = new Runnable() {
                @Override
                public void run() {
                    getUpdatedWriteParameter();
                    mHandlerForReadParameter.postDelayed(this, 450);
                }
            };
            mHandlerForReadParameter.post(mStatusCheckerForReadReadParameter);
        } catch (Exception e) {
            Log.d(TAG, "getReadParameters: " + e);
        }

    }

    public void getUpdatedWriteParameter() {
        try {
            WritableArray writeParameter = new WritableNativeArray();
            for (int i = 0; i < writeParameterList.size(); i++) {
                ReadParameterModel singleParameter = writeParameterList.get(i);
                WritableMap writeParameterMap = new WritableNativeMap();
                writeParameterMap.putString("description", singleParameter.Desc);
                writeParameterMap.putString("value", singleParameter.value);
                writeParameterMap.putString("didHex", singleParameter.didHex);
                writeParameterMap.putString("newValue", singleParameter.newValueFromUser);
                writeParameterMap.putString("valueType", singleParameter.dataType.toString());
                writeParameterMap.putString("maxValue", singleParameter.getMaxValue());
                writeParameterMap.putString("minValue", singleParameter.getMinValue());
                writeParameterMap.putBoolean("isCallProPackStatusUploadApi",
                        singleParameter.isCallProPackStatusUploadApi());

                writeParameterMap.putBoolean("isRedColorEnable", singleParameter.isRedColorEnable());
                writeParameterMap.putBoolean("showProgress", singleParameter.isShowProgress());
                writeParameterMap.putBoolean("isResultRaw", singleParameter.isResultRaw());
                writeParameterMap.putString("checkDid", singleParameter.getCheckDid());
                writeParameterMap.putString("resultToPass", singleParameter.getResultToPass());
                writeParameterMap.putString("resultToFail", singleParameter.getResultToFail());
                writeParameterMap.putInt("timeoutInMs", singleParameter.getTimeoutInMs());

                WritableArray hints = new WritableNativeArray();
                if (singleParameter.listOfOptionToEnter != null) {
                    for (String hint : singleParameter.listOfOptionToEnter) {
                        hints.pushString(hint);
                    }
                }
                writeParameterMap.putArray("hint", hints);
                writeParameter.pushMap(writeParameterMap);
            }
            WritableMap data = new WritableNativeMap();
            data.putArray("data", writeParameter);
            data.putString("name", "writeparameters");
            data.putBoolean("success", true);
            sendEvent("writeparameters", data);
        } catch (Exception e) {
            Log.d(TAG, "getUpdatedReadParameters: " + e);
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void getWriteDidParameter(int pos, String description, String newValue, Promise promise) {
        try {
            subscribeToUpdateUI();
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            // List<ReadParameterModel> writeParameterList =
            // balDongleLib.getWriteParameter(ecuRecord);
            ReadParameterModel readParameterModel = new ReadParameterModel();

            for (int i = 0; i < writeParameterList.size(); i++) {
                ReadParameterModel singleParameter = writeParameterList.get(i);
                if (singleParameter.Desc.equals(description)) {
                    readParameterModel = singleParameter;
                }
            }
            readParameterModel.newValueFromUser = newValue;
            balDongleLib.writeDidParameter(ecuRecord, readParameterModel, pos);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("100", "Something went wrong");
            Log.e(TAG, "getWriteDidParameter error: " + e.getMessage());
        }
    }

    @ReactMethod
    public void resetConfig(int pos) {

        subscribeToUpdateUI();
        ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
        Log.d(TAG, "resetConfig: " + this.balDongleLib.isConnected());
        balDongleLib.resetConfig(ecuRecord);

    }

    @ReactMethod
    public void UDSParameter(int pos) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            balDongleLib.getUDSParameter(ecuRecord);
        } catch (Exception e) {
            Log.d(TAG, "resetConfig: " + e);
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void saveAppLog(int pos) {
        try {
            ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
            balDongleLib.saveAppLog(ecuRecord);
        } catch (Exception e) {
            Log.d(TAG, "resetConfig: " + e);
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void isUploadBothLog(int pos, Promise promise) {
        ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
        Boolean res = ecuRecord.isUploadBothLog();
        Log.d(TAG, "isUploadBothLog: " + res);
        promise.resolve(res);
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void isValidVin(String vin, Promise promise) {
        try {
            Boolean res = balDongleLib.isValidVin(vin);
            promise.resolve(res);
        } catch (Exception e) {
            Log.d(TAG, "resetConfig: " + e);
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void validateVIN(String vin, Promise promise) {
        try {
            Boolean res = balDongleLib.validateVIN(vin);
            Log.d(TAG, res + " validateVIN " + vin);
            promise.resolve(res);
        } catch (Exception e) {
            Log.d(TAG, "resetConfig: " + e);
        }

    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void validateBIN(String bin, Promise promise) {
        try {
            Boolean res = balDongleLib.validateBIN(bin);
            Log.d(TAG, res + " validateBIN " + bin);
            promise.resolve(res);
        } catch (Exception e) {
            Log.d(TAG, "resetConfig: " + e);
        }

    }

    private void sendEvent(String eventName, WritableMap body) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, body);
        } else {
            Log.e(TAG, "There is currently no active Catalyst instance");
        }
    }

    private void onChangeLiveDataSendEvent(String eventName, String s) {
        WritableMap res = new WritableNativeMap();
        res.putString("name", eventName);
        if (s == "null" || s == null) {
            res.putNull("value");
        } else {
            res.putString("value", s);
        }
        if (reactContext.hasActiveReactInstance()) {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, res);
        } else {
            Log.e(TAG, "There is currently no active Catalyst instance");
        }
    }

    private void onChangeLiveDataSendEvent(String eventName, WritableArray s) {
        WritableMap res = new WritableNativeMap();
        res.putString("name", eventName);
        if (s == null) {
            res.putNull("value");
        } else {
            res.putArray("value", s);
        }
        if (reactContext.hasActiveReactInstance()) {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, res);
        } else {
            Log.e(TAG, "There is currently no active Catalyst instance");
        }
    }

    private void onChangeLiveDataSendEvent(String eventName, WritableMap s) {
        WritableMap res = new WritableNativeMap();
        res.putString("name", eventName);
        if (s == null) {
            res.putNull("value");
        } else {
            res.putMap("value", s);
        }
        if (reactContext.hasActiveReactInstance()) {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(eventName, res);
        } else {
            Log.e(TAG, "There is currently no active Catalyst instance");
        }
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void deleteBalLogs() {
        File source = new File(getReactApplicationContext().getDataDir().toString() + "/BALAppLog");
        deleteRecursive(source);
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void setReadParamAutoRefresh(boolean isAutoRefresh, int pos) {
        ECURecord ecuRecord = balDongleLib.getEcuRecord(pos);
        ecuRecord.setReadParamAutoRefresh(isAutoRefresh);
    }

    @ReactMethod
    @SuppressWarnings("unused")
    public void stopAllTimersFromReact() {
        // mainTimer.stopTimer();
        subTimer.stopTimer();
        parsingTimer.stopTimer();
        actTimer.stopTimer();
    }

    @Override
    public void onHostResume() {

    }

    @Override
    public void onHostPause() {

    }

    @Override
    public void onHostDestroy() {
        reactContext.unregisterReceiver(bluetoothDeviceListener);
    }

    private void stopAllTimer() {
        // mainTimer.stopTimer();
        subTimer.stopTimer();
        parsingTimer.stopTimer();
    }

    public void stopFlashing() {
        balDongleLib.stopFlashing(flashingEcuRecord);
    }

    public class TimerUtils {
        private CountDownTimer countDownTimer;

        public void startTimer(long durationInMillis, String type, Boolean isStartTimer) {

            countDownTimer = new CountDownTimer(durationInMillis, 1000) {
                @Override
                public void onTick(long millisUntilFinished) {
                    if (isStartTimer) {
                        long millisDone = durationInMillis - millisUntilFinished;
                        int sec = (int) (millisDone / 1000);
                        if (sec < 19) {
                            WritableMap progressMap = new WritableNativeMap();
                            progressMap.putInt("mainProgress", sec * 5);
                            progressMap.putInt("subProgress", sec * 5);
                            progressMap.putString("status", STARTED_PARSING_TAG);
                            onChangeLiveDataSendEvent(type, progressMap);
                        }
                    }
                }

                @Override
                public void onFinish() {
                    // Trigger your method here
                    performActionAfterTimer(type);
                }
            };
            countDownTimer.start();
        }

        public void resetTimer(long resetDurationInMillis, String type, Boolean isStatTimer) {
            if (countDownTimer != null) {
                countDownTimer.cancel();
                countDownTimer = null;
            }
            startTimer(resetDurationInMillis, type, isStatTimer);
        }

        public boolean isTimerRunning() {
            return countDownTimer != null;
        }

        public void stopTimer() {
            if (countDownTimer != null) {
                countDownTimer.cancel();
                countDownTimer = null;
            }
        }

        private void performActionAfterTimer(String type) {
            Log.d(TAG, "performActionAfterTimer: over");
            stopFlashing();
            stopAllTimer();
            WritableMap progressMap = new WritableNativeMap();
            progressMap.putInt("mainProgress", -1);
            progressMap.putInt("subProgress", -1);
            progressMap.putString("status", "Operation Time Out, Please try again");
            onChangeLiveDataSendEvent(type, progressMap);
        }
    }

    public class TimerUtilsForActuator {
        private CountDownTimer countDownTimer;

        public void startTimer(long durationInMillis) {

            countDownTimer = new CountDownTimer(durationInMillis, 1000) {
                @Override
                public void onTick(long millisUntilFinished) {

                }

                @Override
                public void onFinish() {
                    // Trigger your method here
                    performActionAfterTimer();
                }
            };
            countDownTimer.start();
        }

        public void resetTimer(long resetDurationInMillis) {
            if (countDownTimer != null) {
                countDownTimer.cancel();
                countDownTimer = null;
            }
            startTimer(resetDurationInMillis);
        }

        public boolean isTimerRunning() {
            return countDownTimer != null;
        }

        public void stopTimer() {
            if (countDownTimer != null) {
                countDownTimer.cancel();
                countDownTimer = null;
            }
        }

        private void performActionAfterTimer() {
            onChangeLiveDataSendEvent("actuator",
                    "{\"status\":false,\"message\":\"Time out\",\"processStatus\":\"Done\",\"RoutinePosOnUI\":0,\"StepNo\":0}");
        }
    }

    public class TimerUtilsForEEDump {
        private CountDownTimer countDownTimer;

        public void startTimer(long durationInMillis) {

            countDownTimer = new CountDownTimer(durationInMillis, 1000) {
                @Override
                public void onTick(long millisUntilFinished) {

                }

                @Override
                public void onFinish() {
                    // Trigger your method here
                    performActionAfterTimer();
                }
            };
            countDownTimer.start();
        }

        public void resetTimer(long resetDurationInMillis) {
            if (countDownTimer != null) {
                countDownTimer.cancel();
                countDownTimer = null;
            }
            startTimer(resetDurationInMillis);
        }

        public boolean isTimerRunning() {
            return countDownTimer != null;
        }

        public void stopTimer() {
            if (countDownTimer != null) {
                countDownTimer.cancel();
                countDownTimer = null;
            }
        }

        private void performActionAfterTimer() {
            onChangeLiveDataSendEvent("eeDump",
                    "{\"status\":false,\"message\":\"EEDump failed\",\"processStatus\":\"Done\",\"isReadyToUpload\":false,\"StepNo\":0}");
        }
    }

    public class TimerUtilsWith200Mills {
        private CountDownTimer countDownTimer;

        public void startTimer(long durationInMillis, String type, Boolean isStartTimer) {

            countDownTimer = new CountDownTimer(durationInMillis, 100) {
                @Override
                public void onTick(long millisUntilFinished) {
                    if (isStartTimer) {
                        long millisDone = durationInMillis - millisUntilFinished;
                        int cycle = (int) (millisDone / 100);
                        if (cycle <= 98) {
                            WritableMap progressMap = new WritableNativeMap();
                            progressMap.putInt("mainProgress", cycle);
                            progressMap.putInt("subProgress", cycle);
                            progressMap.putString("status", STARTED_PARSING_TAG);
                            onChangeLiveDataSendEvent(type, progressMap);
                        }
                    }
                }

                @Override
                public void onFinish() {
                    // Trigger your method here
                    performActionAfterTimer(type);
                }
            };
            countDownTimer.start();
        }

        public void resetTimer(long resetDurationInMillis, String type, Boolean isStatTimer) {
            if (countDownTimer != null) {
                countDownTimer.cancel();
                countDownTimer = null;
            }
            startTimer(resetDurationInMillis, type, isStatTimer);
        }

        public boolean isTimerRunning() {
            return countDownTimer != null;
        }

        public void stopTimer() {
            if (countDownTimer != null) {
                countDownTimer.cancel();
                countDownTimer = null;
            }
        }

        private void performActionAfterTimer(String type) {
            stopFlashing();
            Log.d(TAG, "performActionAfterTimer: over");
            stopAllTimer();
            WritableMap progressMap = new WritableNativeMap();
            progressMap.putInt("mainProgress", -1);
            progressMap.putInt("subProgress", -1);
            progressMap.putString("status", "Operation Time Out, Please try again");
            onChangeLiveDataSendEvent(type, progressMap);
        }

    }

}
