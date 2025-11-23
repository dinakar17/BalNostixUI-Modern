package com.nostix.device;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.os.ParcelUuid;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

import java.util.HashMap;
import java.util.Map;

public class NativeDevice {

    private final BluetoothDevice mDevice;
    private final Map<String, Object> mExtra;

    public NativeDevice(BluetoothDevice device) {
        this.mDevice = device;
        this.mExtra = new HashMap<>();
    }

    public BluetoothDevice getDevice() {
        return mDevice;
    }

    public String getAddress() {
        return mDevice.getAddress();
    }

    @SuppressLint("MissingPermission")
    public String getName() {
        return mDevice.getName();
    }

    @SuppressLint("MissingPermission")
    public int getBondState() {
        return mDevice.getBondState();
    }

    @SuppressLint("MissingPermission")
    public BluetoothClass getBluetoothClass() {
        return mDevice.getBluetoothClass();
    }

    @SuppressLint("MissingPermission")
    public ParcelUuid[] getUuids() {
        return mDevice.getUuids();
    }

    @SuppressLint("MissingPermission")
    public <T> T getExtra(String key) {
        return (T) mExtra.get(key);
    }

    public <T> T putExtra(String key, T value) {
        return (T) mExtra.put(key, value);
    }

    @SuppressLint("MissingPermission")
    public WritableMap map() {
        WritableMap mapped = Arguments.createMap();

        mapped.putString("name", mDevice.getName() != null ? mDevice.getName() : mDevice.getAddress());
        mapped.putString("address", mDevice.getAddress());
        mapped.putString("id", mDevice.getAddress());
        mapped.putBoolean("bonded", mDevice.getBondState() == BluetoothDevice.BOND_BONDED);

        if (mDevice.getBluetoothClass() != null) {
            WritableMap deviceClass = Arguments.createMap();
            deviceClass.putInt("deviceClass", mDevice.getBluetoothClass().getDeviceClass());
            deviceClass.putInt("majorClass", mDevice.getBluetoothClass().getMajorDeviceClass());
        }

        mapped.putMap("extra", Arguments.makeNativeMap(mExtra));

        return mapped;
    }
}
