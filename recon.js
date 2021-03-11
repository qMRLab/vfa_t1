/*
================== qMRLab vfa_t1 pulse sequence = 
This script is responsible for collecting raw data 
and reconstructing images. 
 
Waveforms exported by SpinBench and described by application.apd
determine the initial state of the sequence. For this 
application, initial parameters are fetched from: 

- [excitation] SincRF + Z (SlabSelect.spv)
- [echodelay] in us, to be exposed to GUI. (Not linked to a file)
- [readout] 3D Cartesian Readout (CartesianReadout3D.spv)
- [spoiler] Area Trapezoid  (SpoilerGradient.spv)

For now, base resolution components are hardcoded to be 
256X256mm (inplane) and 5mm (slab thickness) for the 
3D readout. 

TODO: These parameters are to be fetched from controller. 

Author:  Agah Karakuzu agahkarakuzu@gmail.com
Created: October, 2019. 
// =================================================
*/

var sequenceId = rth.sequenceId();
var instanceName = rth.instanceName();

var observer = new RthReconRawObserver();
observer.setSequenceId(sequenceId);
observer.observeValueForKey("acquisition.samples", "samples");
// Disable button after observer is discond
observer.scanDisabled.connect(rth.deactivateScanButton);

function reconBlock(input) {
  
  var that  = this;
  //this.sort = new RthReconRawToImageSort();
  
  //this.sort.observeKeys(["acquisition.samples","reconstruction.phaseEncodes","reconstruction.partitions"]);
  //this.sort.observedKeysChanged.connect(function(keys){
   // that.sort.setPhaseEncodes(keys["reconstruction.phaseEncodes"]);
    //that.sort.setSamples(keys["acquisition.samples"]);
    //that.sort.setSliceEncodes(keys["reconstruction.zPartitions"]);
    //that.sort.setAccumulate(keys["reconstruction.phaseEncodes"]*keys["reconstruction.zPartitions"]);
  //});
  
 this.sort3d = new RthReconSort();
 this.sort3d.setIndexKeys(["acquisition.<Cartesian Readout>.index", "acquisition.<Repeat 1>.index"]);
 this.sort3d.setInput(input);
 this.sort3d.observeKeys(["mri.RunNumber"]);
 this.sort3d.observedKeysChanged.connect(
  function(keys) {
    that.sort3d.resetAccumulation();
    var yEncodes = keys["reconstruction.phaseEncodes"];
    var samples = keys["acquisition.samples"];
    //var coils = keys["acquisition.channels"];
    var zEncodes = keys["reconstruction.zPartitions"];
    //this.sort3d.extent = [samples, coils, yEncodes, zEncodes]; // if the input is [samples x coils]
    that.sort3d.extent = [samples, yEncodes, zEncodes]; // if the input is [samples]
    that.sort3d.accumulate = yEncodes * zEncodes;
  }
);

  //this.sort = RthReconSort();
  //this.sort.setIndexKeys(["acquisition.index"]);
  //this.sort.setInput(input);
  //this.sort.setUseSliceEncodeKey(false);
  //this.sort.setSwapSePe(true);
  //this.sort.observeKeys(["acquisition.slice", "acquisition.index"]);
  //this.sort.observedKeysChanged.connect(function(keys){
    //RTHLOGGER_WARNING("Slice" + keys["acquisition.slice"] + "index" + keys["acquisition.index"]);
  //});
  //this.sort.observeKeys(["acquisition.<Repeat 1>.index"]);
  //this.sort.observedKeysChanged.connect(function(keys){
  //  RTHLOGGER_WARNING("Slice" + keys["acquisition.<Repeat 1>.index"]);
  //});
  //this.sort.setExtent([256,256])
  //this.sort.setAccumulate(2*256);
  this.fft = new RthReconImageFFT();
  this.fft.setInput(this.sort3d.output());

  this.output = function() {
  return this.fft.output();
  };
}

// For each `coil we need sort and FFT.

var sos = new RthReconImageSumOfSquares();
var block  = [];

function connectCoils(coils){
  block = [];
  for (var i = 0; i<coils; i++){
    block[i] = new reconBlock(observer.output(i));
    sos.setInput(i,block[i].output());
  }
 rth.collectGarbage();
}

observer.coilsChanged.connect(connectCoils);

rth.importJS("lib:RthImageThreePlaneOutput.js");

function ExportBlock(input){

  var that = this;

  //var imageExport = new RthReconToQmrlab();
  // This is a bit annoying, but the only option for now. 
  this.imageExport = new RthReconImageExport();

  this.changeInformation = new RthReconImageChangeInformation();

  this.reconKeys = [
    // For now, addTag does not support type string. 
    "mri.SequenceName",
    //"mri.ScanningSequence",
    //"mri.SequenceVariant",
    //"mri.MRAcquisitionType",
    "mri.NumberOfCoils",
    "mri.ExcitationTimeBandwidth",
    "mri.ExcitationDuration",
    //"mri.ExcitationType",
    "mri.VoxelSpacing",
    "mri.EchoTime",
    "mri.RepetitionTime",
    "mri.FlipAngle1",
    "mri.FlipAngle2",
    "mri.FlipAngle", // Belonging to the current loop
    "mri.SliceThickness",
    "reconstruction.phaseEncodes",
    "acquisition.samples",
    "reconstruction.zPartitions",
    "mri.PreAcqDuration",
    "geometry.TranslationX",
    "geometry.TranslationY",
    "geometry.TranslationZ",
    "geometry.QuaternionW",
    "geometry.QuaternionX",
    "geometry.QuaternionY",
    "geometry.QuaternionZ",
    "geometry.FieldOfViewX",
    "geometry.FieldOfViewY",
    "geometry.FieldOfViewZ",
    "mri.FlipIndex", // Ensured that this one will change per run.
    "mri.SubjectBIDS",
    "mri.SessionBIDS",
    "mri.AcquisitionBIDS"  
  ];

this.changeInformation.observeKeys(this.reconKeys);

this.changeInformation.observedKeysChanged.connect(function(keys){
  that.changeInformation.addTag("user.NumberOfCoils",keys["mri.NumberOfCoils"]);
  that.changeInformation.addTag("user.SequenceName",keys["mri.SequenceName"]);
  that.changeInformation.addTag("user.ExcitationTimeBandwidth",keys["mri.ExcitationTimeBandwidth"]);
  that.changeInformation.addTag("user.ExcitationDuration",keys["mri.ExcitationDuration"]);
  that.changeInformation.addTag("user.SpacingX",keys["mri.VoxelSpacing"][0]);
  that.changeInformation.addTag("user.SpacingY",keys["mri.VoxelSpacing"][1]);
  that.changeInformation.addTag("user.SpacingZ",keys["mri.VoxelSpacing"][2]);
  that.changeInformation.addTag("user.EchoTime",keys["mri.EchoTime"]);
  that.changeInformation.addTag("user.RepetitionTime",keys["mri.RepetitionTime"]);
  that.changeInformation.addTag("user.FlipAngle1",keys["mri.FlipAngle1"]);
  that.changeInformation.addTag("user.FlipAngle2",keys["mri.FlipAngle2"]);
  that.changeInformation.addTag("user.FlipAngle",keys["mri.FlipAngle"]);
  that.changeInformation.addTag("user.SliceThickness",keys["mri.SliceThickness"]);
  that.changeInformation.addTag("user.NumberOfRows",keys["reconstruction.phaseEncodes"]);
  that.changeInformation.addTag("user.NumberOfColumns",keys["acquisition.samples"]);
  that.changeInformation.addTag("user.PreAcqDuration",keys["mri.PreAcqDuration"]);
  that.changeInformation.addTag("user.TranslationX",keys["geometry.TranslationX"]);
  that.changeInformation.addTag("user.TranslationY",keys["geometry.TranslationY"]);
  that.changeInformation.addTag("user.TranslationZ",keys["geometry.TranslationZ"]);
  that.changeInformation.addTag("user.QuaternionW",keys["geometry.QuaternionW"]);
  that.changeInformation.addTag("user.QuaternionX",keys["geometry.QuaternionX"]);
  that.changeInformation.addTag("user.QuaternionY",keys["geometry.QuaternionY"]);
  that.changeInformation.addTag("user.QuaternionZ",keys["geometry.QuaternionZ"]);
  that.changeInformation.addTag("user.FieldOfViewX",keys["geometry.FieldOfViewX"]);
  that.changeInformation.addTag("user.FieldOfViewY",keys["geometry.FieldOfViewY"]);
  that.changeInformation.addTag("user.FieldOfViewZ",keys["geometry.FieldOfViewZ"]);
});



this.imageExport.observeKeys([
  "mri.SubjectBIDS",
  "mri.SessionBIDS",
  "mri.AcquisitionBIDS",
  "mri.FlipIndex"
]);

this.imageExport.observedKeysChanged.connect(function(keys){
  that.imageExport.addInformationKey("user.NumberOfCoils");
  that.imageExport.addInformationKey("user.SequenceName");
  that.imageExport.addInformationKey("user.ExcitationTimeBandwidth");
  that.imageExport.addInformationKey("user.ExcitationDuration");
  that.imageExport.addInformationKey("user.SpacingX");
  that.imageExport.addInformationKey("user.SpacingY");
  that.imageExport.addInformationKey("user.SpacingZ");
  that.imageExport.addInformationKey("user.EchoTime");
  that.imageExport.addInformationKey("user.RepetitionTime");
  that.imageExport.addInformationKey("user.FlipAngle1");
  that.imageExport.addInformationKey("user.FlipAngle2");
  that.imageExport.addInformationKey("user.FlipAngle");
  that.imageExport.addInformationKey("user.SliceThickness");
  that.imageExport.addInformationKey("user.NumberOfRows");
  that.imageExport.addInformationKey("user.NumberOfColumns");
  that.imageExport.addInformationKey("user.PreAcqDuration");
  that.imageExport.addInformationKey("user.TranslationX");
  that.imageExport.addInformationKey("user.TranslationY");
  that.imageExport.addInformationKey("user.TranslationZ");
  that.imageExport.addInformationKey("user.QuaternionW");
  that.imageExport.addInformationKey("user.QuaternionX");
  that.imageExport.addInformationKey("user.QuaternionY");
  that.imageExport.addInformationKey("user.QuaternionZ");
  that.imageExport.addInformationKey("user.FieldOfViewX");
  that.imageExport.addInformationKey("user.FieldOfViewY");
  that.imageExport.addInformationKey("user.FieldOfViewZ");
    var exportDirectory = "/home/agah/Desktop/AgahHV/";
    var flipIndex = keys["mri.FlipIndex"];
    var subjectBIDS  = "sub-" + keys["mri.SubjectBIDS"];
    var sessionBIDS = (keys["mri.SessionBIDS"]) ? "_ses-" + keys["mri.SessionBIDS"] : "";
    var acquisitionBIDS = (keys["mri.AcquisitionBIDS"]) ? "_acq-" + keys["mri.AcquisitionBIDS"] : "";
    var exportFileName  = exportDirectory + subjectBIDS + sessionBIDS + acquisitionBIDS + "_flip-" + flipIndex + "_VFAT1.dat";
    that.imageExport.setFileName(exportFileName);

  });
  
  //this.imageExport.observeKeys(["mri.RunNumber", // Ensured that this one will change per run.
  //                              "mri.SubjectBIDS",
  //                              "mri.SessionBIDS",
  //                              "mri.AcquisitionBIDS"  
  //]);
  //this.imageExport.observedKeysChanged(function(keys){
  //  var flipIndex = keys["mri.RunNumber"] + 1;
  //  var subjectBIDS  = "sub-" + keys["mri.SessionBIDS"]; 
  //  var sessionBIDS = (keys["mri.SessionBIDS"]!=="") ? "_ses-" + keys["mri.SessionBIDS"] : "";
  //  var acquisitionBIDS = (keys["mri.AcquisitionBIDS"]!=="") ? "_acq-" + keys["mri.AcquisitionBIDS"] : "";
  //});

  //var exportDirectory = "/home/agah/Desktop/AgahHV/";
  //var exportFileName  = exportDirectory + subjectBIDS + sessionBIDS + acquisitionBIDS + "_flip-" + flipIndex + '_VFAT1.dat';
  this.imageExport.objectName = "save_image";
  
  this.imageExport.setInput(input);
  
  RTHLOGGER_WARNING("saving...");

  //this.imageExport.saveFileSeries(true);

  // This is a sink node, hence no output.
}


var splitter = RthReconSplitter();
splitter.objectName = "splitOutput";
splitter.setInput(sos.output());


var threePlane = new RthImageThreePlaneOutput();
threePlane.setInput(splitter.output(0));

var exporter  = new ExportBlock(splitter.output(1));
