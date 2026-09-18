"""Create a geometric DICOM phantom. No patient or diagnostic imagery is used."""
import io
import zipfile
from pathlib import Path

import numpy as np
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, generate_uid


def main():
    target = Path(__file__).resolve().parents[1] / 'demo' / 'synthetic-phantom.zip'
    if target.exists():
        print('Synthetic phantom already exists:', target.name)
        return
    target.parent.mkdir(exist_ok=True)
    study, series, frame = generate_uid(), generate_uid(), generate_uid()
    yy, xx = np.mgrid[-128:128, -128:128]
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for index in range(12):
            sop = generate_uid()
            meta = FileMetaDataset()
            meta.MediaStorageSOPClassUID = CTImageStorage
            meta.MediaStorageSOPInstanceUID = sop
            meta.TransferSyntaxUID = ExplicitVRLittleEndian
            ds = FileDataset(None, {}, file_meta=meta, preamble=b'\0' * 128)
            ds.SOPClassUID, ds.SOPInstanceUID = CTImageStorage, sop
            ds.StudyInstanceUID, ds.SeriesInstanceUID = study, series
            ds.FrameOfReferenceUID = frame
            ds.PatientName, ds.PatientID = 'SYNTHETIC^PHANTOM', 'ENGINEERING-ONLY'
            ds.PatientIdentityRemoved = 'YES'
            ds.DeidentificationMethod = 'Generated geometric phantom; no patient data'
            ds.SeriesDescription = 'SYNTHETIC PHANTOM - NOT FOR DIAGNOSIS'
            ds.ImageType = ['DERIVED', 'SECONDARY', 'AXIAL']
            ds.Modality, ds.Rows, ds.Columns = 'CT', 256, 256
            ds.ImagePositionPatient = [0, 0, index * 2.5]
            ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
            ds.PixelSpacing, ds.SliceThickness = [1, 1], 2.5
            ds.InstanceNumber = index + 1
            ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, 'MONOCHROME2'
            ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 16, 15, 1
            ds.RescaleIntercept, ds.RescaleSlope = 0, 1
            ds.WindowCenter, ds.WindowWidth = 40, 400
            radius = 85 + index
            pixels = np.full((256, 256), -1000, dtype=np.int16)
            pixels[xx**2 + yy**2 < radius**2] = 30
            pixels[(xx + 35)**2 + yy**2 < (12 + index)**2] = 300
            pixels[(xx - 35)**2 + yy**2 < 20**2] = -500
            pixels[np.abs(xx) < 2] = 80
            ds.PixelData = pixels.tobytes()
            content = io.BytesIO()
            ds.save_as(content, enforce_file_format=True)
            archive.writestr(f'phantom-{index + 1:02d}.dcm', content.getvalue())
    print('Created 12 synthetic geometric slices:', target.name)


if __name__ == '__main__':
    main()
