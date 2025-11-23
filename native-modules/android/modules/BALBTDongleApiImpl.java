package com.nostix;

import android.content.Context;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.LiveData;

import com.bal.balnostix.base.ECURecord;
import com.bal.balnostix.base.ErrorCodeModel;
import com.bal.balnostix.base.FlashingUpdateModel;
import com.bal.balnostix.base.ReadParameterModel;
import com.bal.balnostix.base.utils.DtcStatusType;
import com.bal.balnostix.base.utils.xmlparse.Routine;
import com.bal.balnostix.dongle.BALBTDongleLib;
import com.bal.balnostix.dongle.utils.BLog;


import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

public class BALBTDongleApiImpl {

    BALBTDongleLib balBTDongleLib;
    LiveData liveDataOfDTD;

    public BALBTDongleApiImpl(InputStream mInputStream, OutputStream mOutputStream) {
        try {
            balBTDongleLib = new BALBTDongleLib(mInputStream, mOutputStream);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public BALBTDongleApiImpl(@NonNull UsbDeviceConnection usbDeviceConnection, @NonNull UsbEndpoint readEndPoint, @NonNull UsbEndpoint writeEndPoint ) {
        try {
            balBTDongleLib = new BALBTDongleLib(usbDeviceConnection,readEndPoint, writeEndPoint);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public boolean isConnected() {
        return balBTDongleLib.isConnected();
    }

    public boolean initBTDongleComm(String bt_dongle_name) {
        boolean BTDongleComm = balBTDongleLib.initBTDongleComm(bt_dongle_name);
        return BTDongleComm;
    }

    public void setPackageDir(Context context) throws Exception {
        String packageDir = context.getDataDir().getAbsolutePath();
        this.balBTDongleLib.setPackageDir(packageDir);
    }

    public LiveData<String> readVIN() {
        LiveData<String> liveReadVinData = balBTDongleLib.readVIN();
        return liveReadVinData;
    }

    public void initShutdown() {
		balBTDongleLib.initShutdown();
    }
    public void startSelfFlash(ECURecord ecuRecord) {
        balBTDongleLib.startSelfFlash(ecuRecord);
    }
    public void checkIsDongleStuckInBoot() {
        balBTDongleLib.checkIsDongleStuckInBoot();
    }
    public boolean isDonglePhase3() {
        return balBTDongleLib.isDonglePhase3();
        
    }
    
    public String readVin() {
        String liveReadVinData = balBTDongleLib.readVin();
        return liveReadVinData;
    }

    public boolean isValidVin(@NonNull String vin) {
        return balBTDongleLib.isValidVin(vin);
    }

    public boolean validateVIN(@NonNull String vin) {
        return balBTDongleLib.validateVIN(vin);
    }

    public LiveData<FlashingUpdateModel> writeVIN(String vin, ECURecord ecuRecord) {
        return balBTDongleLib.writeVIN(vin, ecuRecord);
    }
    public LiveData<FlashingUpdateModel> writeProgConst(ECURecord ecuRecord) {
        return balBTDongleLib.writeProgConst( ecuRecord);
    }

    public boolean validateBIN(@NonNull String bin) {
        return balBTDongleLib.validateBIN(bin);
    }
    
    public LiveData<FlashingUpdateModel> writeBIN(String bin, ECURecord ecuRecord) {
        return balBTDongleLib.writeBIN(bin, ecuRecord);
    }

    public ArrayList<ECURecord> getEcuRecords(@NonNull String ecuRecordsJson) {
        ArrayList<ECURecord> ecuRecordList = balBTDongleLib.getEcuRecords(ecuRecordsJson);
        return ecuRecordList;
    }

    public ECURecord getEcuRecord(int pos) {
        ECURecord ecuRecord = balBTDongleLib.getEcuRecord(pos);
        return ecuRecord;
    }

    public void handleRes(ArrayList<ErrorCodeModel> data) {
        for (ErrorCodeModel errorDID : data) {
            Log.d("TAG", "handleRes: " + errorDID.toString());
        }
    }

    public void subscribe(ECURecord ecuRecord) {
        liveDataOfDTD = balBTDongleLib.scanDtcErrorCode(ecuRecord);
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                liveDataOfDTD.observeForever(errorDID -> {

                    handleRes((ArrayList) errorDID);
                });
            }
        });
    }

    public LiveData<ArrayList<ErrorCodeModel>> scanDtcErrorCode(ECURecord ecuRecord) {
        LiveData<ArrayList<ErrorCodeModel>> errorCodeList = balBTDongleLib.scanDtcErrorCode(ecuRecord);
        return errorCodeList;
    }

    public LiveData<String> clearErrorCode(ECURecord ecuRecord, String errorCodeType) {
        LiveData<String> clrErrCode = null;
        if (errorCodeType.equals("Current")) {
            clrErrCode = balBTDongleLib.clearErrorCode(ecuRecord, DtcStatusType.Active);

        } else if (errorCodeType.equals("History")) {
            clrErrCode = balBTDongleLib.clearErrorCode(ecuRecord, DtcStatusType.InActive);
        } else if (errorCodeType.equals("Both")) {
            clrErrCode = balBTDongleLib.clearErrorCode(ecuRecord, DtcStatusType.Both);
        }

        return clrErrCode;
    }

    // public LiveData<String> clearDTCStaus(ECURecord ecuRecord) {
    // LiveData<String> status = balBTDongleLib.clearDTCStaus(ecuRecord);
    // return status;
    // }

    public ArrayList<String> getDIDGroups(ECURecord ecuRecord) {
        ArrayList<String> didGroups = balBTDongleLib.getDIDGroups(ecuRecord);
        return didGroups;
    }

    public ArrayList<ReadParameterModel> getListOfReadParameter(ECURecord ecuRecord, String groupName) {
        ArrayList<ReadParameterModel> readParameterList = balBTDongleLib.getListOfReadParameter(ecuRecord, groupName);
        for (ReadParameterModel r : readParameterList) {
            Log.d("balBTDongleLib", "getListOfReadParameter: " + r.toString());

        }
        Log.d("balBTDongleLib", "getListOfReadParameter: " + readParameterList);
        return readParameterList;
    }

    public LiveData<String> startAnalyticsGraph() {
        LiveData<String> srtAnaGraph = balBTDongleLib.startAnalyticsGraph();
        return srtAnaGraph;
    }

    public LiveData<String> startActuatorRoutines(ECURecord ecuRecord, Routine routine, int i) {
        LiveData<String> srtActuRoutines = balBTDongleLib.startActuatorRoutines(ecuRecord, routine, i);
        return srtActuRoutines;
    }

    public LiveData<String> updateBootLoader() {
        LiveData<String> updateBoot = balBTDongleLib.updateBootLoader();
        return updateBoot;
    }

    public List<ReadParameterModel> getWriteParameter(ECURecord ecuRecord) {
        return balBTDongleLib.getListOfWritableDidParameter(ecuRecord);
    }

    public void writeDidParameter(ECURecord ecuRecord, ReadParameterModel readParameterModel, int pos) {

        balBTDongleLib.writeDidParameter(ecuRecord, readParameterModel, pos);
    }

    public void resetConfig(ECURecord ecuRecord) {
        balBTDongleLib.resetConfig(ecuRecord);
    }

    public void getUDSParameter(ECURecord ecuRecord) {
        balBTDongleLib.getUDSParameter(ecuRecord);
    }

    public boolean isBootUpdateRequired(ECURecord ecuRecord) {
        return balBTDongleLib.isBootUpdateRequired(ecuRecord);
    }

    public LiveData<FlashingUpdateModel> getBootFlashingUpdate(ECURecord ecuRecord) {
        return balBTDongleLib.getBootFlashingUpdate(ecuRecord);
    }

    public LiveData<FlashingUpdateModel> getFlashingUpdate(ECURecord ecuRecord) {
        return balBTDongleLib.getFlashingUpdate(ecuRecord);
    }

    public LiveData<String> updateUIDataUpdated() {
        Log.d("TAG", "updateUIDataUpdated: CALLED");

        return balBTDongleLib.updateUIDataUpdated();
    }

    public ArrayList<Routine> displayListActuatorRoutines(ECURecord ecuRecord) {
        return balBTDongleLib.displayListActuatorRoutines(ecuRecord);
    }

    public void readEcuBasicnfo(ECURecord ecuRecord) {
        BLog.e("readEcuBasicnfo func");
        balBTDongleLib.readEcuBasicnfo(ecuRecord);
    }

    public void saveAppLog(ECURecord ecuRecord) {
        balBTDongleLib.saveAppLog(ecuRecord);
    }

    public void saveAppLog() {
        balBTDongleLib.saveAppLog();
    }

    public List<File> getListOfBalFailLogFiles() {
        return getListOfBalFailLogFiles();
    }

    public List<File> getListOfBalAppLogFiles() {
        return getListOfBalAppLogFiles();
    }

    public void resetConfig() {
        balBTDongleLib.resetConfig();
    }

    public void stop() {
        balBTDongleLib.stop();
    }

    public void setClientInfo(String applicationName, String applicationId, String versionName, int versionCode) {
        balBTDongleLib.setClientInfo(applicationName, applicationId, versionName, versionCode);
    }

    public boolean stopFlashing(ECURecord ecuRecord) {
        return balBTDongleLib.stopFlashing(ecuRecord);
    }
    public LiveData<String> startEEDump(ECURecord ecuRecord){

        return balBTDongleLib.startEEDump(ecuRecord);
    }
    
    // add read bin data method
    public LiveData<String> readBinData(ECURecord ecuRecordOfBMS, ECURecord ecuRecordOfVCU) {
        return balBTDongleLib.readBinData(ecuRecordOfBMS, ecuRecordOfVCU);
    }

    // add method to get the version info
    public String getVersionInfo() {
        return balBTDongleLib.getNostixLibInfo();
    }
}
