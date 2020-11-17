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


function reconBlock(input) {

  this.sort = new RthReconRawToImageSort();
  
  this.sort.observeKeys(["acquisition.samples","reconstruction.phaseEncodes","reconstruction.partitions"]);
  this.sort.observeKeysChanged.connect(function(keys){
    this.sort.setPhaseEncodes(keys["reconstruction.phaseEncodes"]);
    this.sort.setSamples(keys["acquisition.samples"]);
    this.sort.setPhaseEncodes(keys["reconstruction.zPartitions"]);
    this.sort.setAccumulate(keys["reconstruction.phaseEncodes"]*keys["reconstruction.zPartitions"]);
  });

  //this.sort = RthReconSort();
  //this.sort.setIndexKeys(["acquisition.index"]);
  this.sort.setInput(input);
  this.sort.observeKeys(["acquisition.slice"]);
  this.sort.observeKeysChanged.connect(function(keys){
    RTHLOGGER_WARNING(keys["acquisition.slice"]);
  });
  //this.sort.setExtent([256,256])
  //this.sort.setAccumulate(2*256);
  this.fft = new RthReconImageFFT();
  this.fft.setInput(this.sort.output());

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

  var date = new Date();

  //var imageExport = new RthReconToQmrlab();
  // This is a bit annoying, but the only option for now. 
  this.imageExport = new RthReconImageExport();
  this.imageExport.observeKeys([
    "mri.SequenceName",
    "mri.ScanningSequence",
    "mri.SequenceVariant",
    "mri.MRAcquisitionType",
    "mri.NumberOfCoils",
    "mri.ExcitationTimeBandwidth",
    "mri.ExcitationDuration",
    "mri.ExcitationType",
    "mri.VoxelSpacing",
    "mri.EchoTime",
    "mri.RepetitionTime",
    "mri.FlipAngle1",
    "mri.FlipAngle2",
    "mri.FlipAngle", // Belonging to the current loop
    "mri.SliceThickness"
  ]);
  this.imageExport.observeKeysChanged.connect(function(keys){
    that.imageExport.addTag("deneme",keys["mri.SequenceName"]);
  });
  var exportDirectory = "/home/agah/Desktop/AgahHV/";
  var exportFileName  = exportDirectory + instanceName + date.getFullYear() + date.getMonth() + date.getSeconds() + '.dat';
  this.imageExport.objectName = "save_image";
  
  this.imageExport.setInput(input);
  this.imageExport.setFileName(exportFileName);
  RTHLOGGER_WARNING("saving...");

  this.imageExport.saveFileSeries(true);

  // This is a sink node, hence no output.
}





var splitter = RthReconSplitter();
splitter.objectName = "splitOutput";
splitter.setInput(sos.output());


var threePlane = new RthImageThreePlaneOutput();
threePlane.setInput(splitter.output(0));

var exporter  = new ExportBlock(splitter.output(1));
exporter.setInput(splitter.output(1));
