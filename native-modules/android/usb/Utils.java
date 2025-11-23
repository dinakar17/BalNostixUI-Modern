package com.nostix.usb;

import android.hardware.usb.UsbConstants;
import android.util.Log;

import androidx.annotation.IntDef;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

public class Utils {


    public static final int USB_WRITE_TIMEOUT_MILLIS = 5000;
    public static final int READ_HEADER_LENGTH = 2; // contains MODEM_STATUS


    public static final int REQTYPE_HOST_TO_DEVICE = UsbConstants.USB_TYPE_VENDOR | UsbConstants.USB_DIR_OUT;
    public static final int REQTYPE_DEVICE_TO_HOST = UsbConstants.USB_TYPE_VENDOR | UsbConstants.USB_DIR_IN;

    public static final int RESET_REQUEST = 0;
    public static final int MODEM_CONTROL_REQUEST = 1;
    public static final int SET_BAUD_RATE_REQUEST = 3;
    public static final int SET_DATA_REQUEST = 4;
    public static final int GET_MODEM_STATUS_REQUEST = 5;
    public static final int SET_LATENCY_TIMER_REQUEST = 9;
    public static final int GET_LATENCY_TIMER_REQUEST = 10;

    public static final int MODEM_CONTROL_DTR_ENABLE = 0x0101;
    public static final int MODEM_CONTROL_DTR_DISABLE = 0x0100;
    public static final int MODEM_CONTROL_RTS_ENABLE = 0x0202;
    public static final int MODEM_CONTROL_RTS_DISABLE = 0x0200;
    public static final int MODEM_STATUS_CTS = 0x10;
    public static final int MODEM_STATUS_DSR = 0x20;
    public static final int MODEM_STATUS_RI = 0x40;
    public static final int MODEM_STATUS_CD = 0x80;
    public static final int RESET_ALL = 0;
    public static final int RESET_PURGE_RX = 1;
    public static final int RESET_PURGE_TX = 2;

    public boolean baudRateWithPort = false;
    public boolean dtr = false;
    public boolean rts = false;
    public int breakConfig = 0;


    int DATABITS_5 = 5;
    /**
     * 6 data bits.
     */
    int DATABITS_6 = 6;
    /**
     * 7 data bits.
     */
    int DATABITS_7 = 7;
    /**
     * 8 data bits.
     */
    int DATABITS_8 = 8;

    /**
     * Values for setParameters(..., parity)
     */

    int PARITY_NONE = 0;
    /**
     * Odd parity.
     */
    int PARITY_ODD = 1;
    /**
     * Even parity.
     */
    int PARITY_EVEN = 2;
    /**
     * Mark parity.
     */
    int PARITY_MARK = 3;
    /**
     * Space parity.
     */
    int PARITY_SPACE = 4;

    /**
     * 1 stop bit.
     */
    int STOPBITS_1 = 1;
    /**
     * 1.5 stop bits.
     */
    int STOPBITS_1_5 = 3;
    /**
     * 2 stop bits.
     */
    int STOPBITS_2 = 2;

    /**
     * Values for get[Supported]ControlLines()
     */
    enum ControlLine {RTS, CTS, DTR, DSR, CD, RI}

    public static final String TAG = "UsbService";

    public static int[] getStringToInt(String data, int length) {
        length = 8 + 2;
        int[] convertedData = new int[length];
        int index = 0;
        try {
            while (index < length * 2) {
                convertedData[index / 2] = Integer.parseInt(data.substring(index, index + 2), 16);
                index += 2;
            }
        } catch (Exception e) {
            e.printStackTrace();
            Log.i(TAG, "Not able to send the data wrong format getStringToInt param");
        }

        return convertedData;
    }

    public static int[] getConvertedFrame(int[] data) {

        int msgLength = 13;
        int[] msgMod = new int[msgLength];
        System.arraycopy(data, 0, msgMod, 1, data.length);
        msgMod[0] = 90;
        msgMod[11] = 165;
        msgMod[12] = 10;

        return msgMod;

    }

    public static byte[] getStringToByte(String data, int length)
    {
        length =  1 + 2 + 8 + 2;
        byte[] convertedData = new byte[length];
        int index = 0 ;
        try {
            while(index < length*2)
            {
                convertedData[index/2]  = (byte) Integer.parseInt(data.substring(index, index + 2), 16);
                index += 2;
            }
        } catch (Exception e) {
            e.printStackTrace();
            Log.i(TAG,"Not able to send the data wrong format getStringToByte");
        }
        return  convertedData;
    }
    public static String stringtoHex(String asciiString){
        StringBuilder hexstring = new StringBuilder();
        for (char c : asciiString.toCharArray()){
            int asciiValue = (int) c;
            String hexValue = Integer.toHexString(asciiValue);


            if (hexValue.length()==1){
                hexValue = "0" + hexValue;
            }
            hexstring.append(hexValue);
        }
        return hexstring.toString();
    }


    public static int[] stringToInt(String data, int length)
    {
        length =  8 + 2;
        int[] convertedData = new int[length];
        int index = 0 ;
        while(index < length*2)
        {
            convertedData[index/2]  = Integer.parseInt(data.substring(index, index + 2), 16);
            index += 2;
        }

        return  convertedData;
    }
}
