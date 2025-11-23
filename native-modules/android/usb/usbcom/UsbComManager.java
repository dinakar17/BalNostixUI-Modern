package com.nostix.usb.usbcom;





import static com.nostix.usb.UsbSerialPort.*;
import static com.nostix.usb.Utils.*;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.hardware.usb.UsbRequest;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.bal.balnostix.base.ECURecord;
import com.bal.balnostix.base.FlashingUpdateModel;
import com.bal.balnostix.dongle.BALBTDongleLib;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.HashMap;

public class UsbComManager {
    private UsbDeviceConnection usbConnection;
    private UsbEndpoint readEndPoint;
    private UsbEndpoint writeEndPoint;
    String deviceInfo = "";

    MutableLiveData<String> readDataMLD = new MutableLiveData<>();
    LiveData<String> readDataLD=readDataMLD;

    public LiveData<String> getReadDataLD() {
        return readDataLD;
    }


    private boolean dtr = false;
    private boolean rts = false;
    protected UsbRequest mUsbRequest;
    private boolean baudRateWithPort = false;

    private int breakConfig = 0;

    public UsbComManager(UsbManager usbManager, Context context) {
        this.usbManager = usbManager;
        // initDeviceInfo(usbManager, context);

    }

    private UsbInterface usbInterface;
    HashMap<String, UsbDevice> deviceList;
    UsbDevice usbDevice;
    String deviceManufacturer;

    UsbManager usbManager;
    public static final String TAG = "USBModule_UsbService";
    private static final String ACTION_USB_PERMISSION = "com.example.demouart.Screens";
    public UsbEndpoint getWriteEndPoint() {
        return writeEndPoint;
    }
    public UsbEndpoint getReadEndPoint() {
        return readEndPoint;
    }
    public UsbDeviceConnection getUsbConnection() {
        return usbConnection;
    }

    public void connectDevice(UsbDevice usbDevice) throws IOException {
        try{
            if(usbConnection!=null)
                usbConnection.close();
            usbConnection = usbManager.openDevice(usbDevice);
            this.usbDevice = usbDevice;
            // openInt
            // new usbRequest
            //initlize
            openInt();
            mUsbRequest = new UsbRequest();
            mUsbRequest.initialize(usbConnection, readEndPoint);
            // for stm32 for FTDI
            setParameters(460800,8,1,0);
        }catch(Exception e){
            Log.i(TAG, "connectDevice exception="+e);
        }

    }



    private void openInt() throws IOException {
        //claim interface
        //get endPoints
        if (usbConnection != null) {
            if (usbDevice == null) {
                Log.i(TAG, "openInt: usbDevice==null");

            } else {
                Log.i(TAG, "openInt: usbDevice!=null" + usbDevice.getManufacturerName() + usbDevice.getVendorId());
            }
            usbInterface = usbDevice.getInterface(0);
            if (usbConnection.claimInterface(usbInterface, true)) {
                readEndPoint = usbInterface.getEndpoint(0);
                writeEndPoint = usbInterface.getEndpoint(1);

                Log.i(TAG, "openInt: usbDevice.getInterfaceCount()->" + usbDevice.getInterfaceCount());
                // reset all
                int result = usbConnection.controlTransfer(REQTYPE_HOST_TO_DEVICE, RESET_REQUEST,
                        RESET_ALL, 1, null, 0, USB_WRITE_TIMEOUT_MILLIS);

                if (result != 0) {
                    Log.i(TAG, "Reset failed: result=" + usbDevice.getInterfaceCount());
                    throw new IOException("Reset failed: result=" + result);
                }
                result = usbConnection.controlTransfer(REQTYPE_HOST_TO_DEVICE, MODEM_CONTROL_REQUEST,
                        (dtr ? MODEM_CONTROL_DTR_ENABLE : MODEM_CONTROL_DTR_DISABLE) |
                                (rts ? MODEM_CONTROL_RTS_ENABLE : MODEM_CONTROL_RTS_DISABLE),
                        1, null, 0, USB_WRITE_TIMEOUT_MILLIS);

                if (result != 0) {
                    throw new IOException("Init RTS,DTR failed: result=" + result);
                }

                // mDevice.getVersion() would require API 23
                byte[] rawDescriptors = usbConnection.getRawDescriptors();
                if (rawDescriptors == null || rawDescriptors.length < 14) {
                    throw new IOException("Could not get device descriptors");
                }
                int deviceType = rawDescriptors[13];
                baudRateWithPort = deviceType == 7 || deviceType == 8 || deviceType == 9 // ...H devices
                        || usbDevice.getInterfaceCount() > 1; // FT2232C

                // start a new thread for reading from usb continuously
                //  UsbReadData usbReadData = new UsbReadData();
                // usbReadData.start();

            } else {
                Log.i("Connection null", "failed to get the interface");
            }
        } else {
            Log.i("Connection null", "No connection");// Failed to open a connection
        }

    }

    public void setParameters(int baudRate, int dataBits, int stopBits, int parity) throws IOException {
        if(baudRate <= 0) {
            throw new IllegalArgumentException("Invalid baud rate: " + baudRate);
        }
        setBaudrate(baudRate);

        int config = 0;
        switch (dataBits) {
            case DATABITS_5:
            case DATABITS_6:
                throw new UnsupportedOperationException("Unsupported data bits: " + dataBits);
            case DATABITS_7:
            case DATABITS_8:
                config |= dataBits;
                break;
            default:
                throw new IllegalArgumentException("Invalid data bits: " + dataBits);
        }

        switch (parity) {
            case PARITY_NONE:
                break;
            case PARITY_ODD:
                config |= 0x100;
                break;
            case PARITY_EVEN:
                config |= 0x200;
                break;
            case PARITY_MARK:
                config |= 0x300;
                break;
            case PARITY_SPACE:
                config |= 0x400;
                break;
            default:
                throw new IllegalArgumentException("Invalid parity: " + parity);
        }

        switch (stopBits) {
            case STOPBITS_1:
                break;
            case STOPBITS_1_5:
                throw new UnsupportedOperationException("Unsupported stop bits: 1.5");
            case STOPBITS_2:
                config |= 0x1000;
                break;
            default:
                throw new IllegalArgumentException("Invalid stop bits: " + stopBits);
        }

        int result = usbConnection.controlTransfer(REQTYPE_HOST_TO_DEVICE, SET_DATA_REQUEST,
                config, 1,null, 0, USB_WRITE_TIMEOUT_MILLIS);
        if (result != 0) {
            throw new IOException("Setting parameters failed: result=" + result);
        }
        breakConfig = config;
    }


    private void setBaudrate(int baudRate) throws IOException {
        int divisor, subdivisor, effectiveBaudRate;
        if (baudRate > 3500000) {
            throw new UnsupportedOperationException("Baud rate to high");
        } else if(baudRate >= 2500000) {
            divisor = 0;
            subdivisor = 0;
            effectiveBaudRate = 3000000;
        } else if(baudRate >= 1750000) {
            divisor = 1;
            subdivisor = 0;
            effectiveBaudRate = 2000000;
        } else {
            divisor = (24000000 << 1) / baudRate;
            divisor = (divisor + 1) >> 1; // round
            subdivisor = divisor & 0x07;
            divisor >>= 3;
            if (divisor > 0x3fff) // exceeds bit 13 at 183 baud
                throw new UnsupportedOperationException("Baud rate to low");
            effectiveBaudRate = (24000000 << 1) / ((divisor << 3) + subdivisor);
            effectiveBaudRate = (effectiveBaudRate +1) >> 1;
        }
        double baudRateError = Math.abs(1.0 - (effectiveBaudRate / (double)baudRate));
        if(baudRateError >= 0.031) // can happen only > 1.5Mbaud
            throw new UnsupportedOperationException(String.format("Baud rate deviation %.1f%% is higher than allowed 3%%", baudRateError*100));
        int value = divisor;
        int index = 0;
        switch(subdivisor) {
            case 0:                              break; // 16,15,14 = 000 - sub-integer divisor = 0
            case 4: value |= 0x4000;             break; // 16,15,14 = 001 - sub-integer divisor = 0.5
            case 2: value |= 0x8000;             break; // 16,15,14 = 010 - sub-integer divisor = 0.25
            case 1: value |= 0xc000;             break; // 16,15,14 = 011 - sub-integer divisor = 0.125
            case 3: value |= 0x0000; index |= 1; break; // 16,15,14 = 100 - sub-integer divisor = 0.375
            case 5: value |= 0x4000; index |= 1; break; // 16,15,14 = 101 - sub-integer divisor = 0.625
            case 6: value |= 0x8000; index |= 1; break; // 16,15,14 = 110 - sub-integer divisor = 0.75
            case 7: value |= 0xc000; index |= 1; break; // 16,15,14 = 111 - sub-integer divisor = 0.875
        }
        if(baudRateWithPort) {
            index <<= 8;
            index |= 0+1;
        }
        Log.d(TAG, String.format("baud rate=%d, effective=%d, error=%.1f%%, value=0x%04x, index=0x%04x, divisor=%d, subdivisor=%d",
                baudRate, effectiveBaudRate, baudRateError*100, value, index, divisor, subdivisor));

        int result = usbConnection.controlTransfer(REQTYPE_HOST_TO_DEVICE, SET_BAUD_RATE_REQUEST,
                value, index, null, 0, USB_WRITE_TIMEOUT_MILLIS);
        if (result != 0) {
            throw new IOException("Setting baudrate failed: result=" + result);
        }
        else
        {
            Log.i(TAG, "setBaudrate: ");
        }
    }



    boolean isReadingStarted = true;
    BALBTDongleLib balbtDongleLib;;

    public String getDeviceInfo() {
        return deviceInfo;
    }


}
