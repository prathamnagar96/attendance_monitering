// src/components/OCRScanner.jsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Upload, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { Camera as CapCamera, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import Button from './ui/Button';
import { initOCR, runOCR, runWebOCR } from '../logic/ocrHelper';
import { parsePaddleOutput } from '../logic/ocrParser';

export default function OCRScanner() {
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const fileInputRef = useRef(null); // define right after webcamRef
    const [imageSrc, setImageSrc] = useState(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    const isNative = Capacitor.isNativePlatform();

    useEffect(() => {
        initOCR();
    }, []);

    const runScan = useCallback(async () => {
        setStatus('recognizing');
        setProcessing(true);
        setError('');
        try {
            const result = isNative ? await runOCR() : await runWebOCR(imageSrc);
            const grid = parsePaddleOutput(result);
            navigate('/editor', { state: { guessedGrid: grid } });
        } catch (e) {
            setError(e.message || 'OCR processing failed');
            setStatus('error');
        } finally {
            setProcessing(false);
            setStatus('idle');
        }
    }, [imageSrc, isNative, navigate]);

    const handleNativeScan = async () => {
        try {
            const image = await CapCamera.getPhoto({
                quality: 90,
                allowEditing: true,
                resultType: CameraResultType.Uri,
            });
            setImageSrc(image.webPath);
            setError('');
        } catch (e) {
            console.error('Native camera error', e);
            setError('Failed to access camera');
        }
    };

    const capture = useCallback(() => {
        const shot = webcamRef.current?.getScreenshot();
        if (shot) {
            setImageSrc(shot);
            setError('');
        }
    }, []);

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0]; // ✅ FIXED: Optional chaining for safe access
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result);
                setError('');
            };
            reader.readAsDataURL(file);
        }
    };

    const processImage = () => {
        if (!imageSrc) return;
        runScan();
    };

    const retake = () => {
        setImageSrc(null);
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = ''; // ✅ Now works with declared ref
    };

    return (
        <div
            className="fixed inset-0 z-30 bg-black font-sans text-white"
        >
            {/* Header */}
            <div
                className="absolute top-0 left-0 right-0 z-20 bg-black/50 backdrop-blur-md border-b border-white/10"
                style={{ paddingTop: 'var(--sat)' }}
            >
                <div className="px-4 py-3 flex items-center justify-between h-[60px]">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} className="text-white" />
                    </button>
                    <h1 className="text-base font-bold uppercase tracking-tight text-white">
                        Scan Timetable
                    </h1>
                    <div className="w-8" />
                </div>
            </div>

            {/* Content / Camera View */}
            <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                style={{ paddingTop: 'calc(var(--sat) + 60px)' }}
            >
                {!imageSrc ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
                        <Camera size={48} className="text-gray-400 mb-2" />
                        <p className="text-gray-300 max-w-xs text-sm leading-relaxed">
                            Take a photo or upload an image of your timetable grid. Ensure good
                            lighting and clear text.
                        </p>

                        {/* Native Camera Button (APK/PWA) */}
                        {isNative && (
                            <Button
                                onClick={handleNativeScan}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 mb-4"
                            >
                                <Camera size={20} />
                                Open Camera
                            </Button>
                        )}

                        {/* Web Camera (Desktop/Laptop) */}
                        {!isNative && (
                            <div className="w-full max-w-sm">
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    className="w-full h-64 object-cover rounded-xl border-4 border-white/20 mb-4"
                                    videoConstraints={{
                                        width: 1280,
                                        height: 720,
                                        facingMode: 'environment',
                                    }}
                                />
                                <Button
                                    onClick={capture}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 mb-4"
                                >
                                    <Camera size={20} />
                                    Capture Photo
                                </Button>
                            </div>
                        )}

                        {/* Upload (All platforms) */}
                        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 w-full max-w-sm">
                            <Upload size={18} />
                            <span>Select Image</span>
                            <input
                                ref={fileInputRef} // ✅ Now properly referenced
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </label>
                    </div>
                ) : (
                    <>
                        {/* Image Preview + Actions */}
                        <div className="relative w-full h-full bg-black flex flex-col">
                            <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
                                <img
                                    src={imageSrc}
                                    alt="Timetable Preview"
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
                                />
                                {processing && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                                        <p className="font-semibold text-blue-400 animate-pulse">
                                            Analyzing timetable...
                                        </p>
                                        <p className="text-sm text-gray-400 mt-1">AI OCR processing</p>
                                    </div>
                                )}
                                {status === 'error' && (
                                    <div className="absolute inset-0 bg-red-500/20 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                                        <AlertTriangle size={48} className="text-red-300 mb-4" />
                                        <p className="text-red-200 font-semibold mb-2">{error}</p>
                                        <Button
                                            variant="secondary"
                                            onClick={retake}
                                            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Actions - now safe-area aware */}
                            <div
                                className="p-6 bg-black/80 backdrop-blur-md border-t border-white/10 space-y-3"
                                style={{
                                    paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
                                }}
                            >
                                <Button
                                    onClick={processImage}
                                    disabled={processing || status === 'error'}
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <Check size={20} />
                                    {processing ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            Scanning...
                                        </>
                                    ) : (
                                        'Confirm & Extract Timetable'
                                    )}
                                </Button>

                                <button
                                    onClick={retake}
                                    disabled={processing}
                                    className="w-full py-3 text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={16} />
                                    Retake or Upload New
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
