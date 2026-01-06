import { Ocr } from '@capacitor-community/image-to-text';
import { Camera, CameraResultType } from '@capacitor/camera';

export const initOCR = async () => {
    console.log('✅ Community OCR Ready');
};

export const runOCR = async () => {
    // Native camera photo
    const photo = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64
    });

    // Native OCR
    const detections = await Ocr.getText({
        sourceImage: {
            base64Image: photo.base64String
        }
    });

    const text = detections.textDetections.map(t => t.text).filter(Boolean);

    // ✅ Use cornerPoints/points if provided, else safe 4-corner fallback
    const points = detections.textDetections.map(det => {
        const box = det.cornerPoints || det.points;
        if (Array.isArray(box) && Array.isArray(box[0])) {
            return box;
        }
        return [
            [10, 10],
            [200, 10],
            [200, 60],
            [10, 60],
        ];
    });

    return { text, points }; // parser-ready format
};

// Web Fallback
export const runWebOCR = async (imageSrc) => {
    // Dummy text grid for web/dev; shape matches native OCR output
    const text = ['MON', '9-10AM', 'Math', 'TUE', '9-10AM', 'Physics'];

    // ✅ Each item has 4 corner points: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
    const points = text.map(() => [
        [10, 10],
        [200, 10],
        [200, 60],
        [10, 60],
    ]);

    return { text, points };
};
