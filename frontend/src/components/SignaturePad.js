import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Setup canvas avec devicePixelRatio pour éviter le flou
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Dimensions CSS
    const rect = canvas.getBoundingClientRect();
    
    // Dimensions internes du canvas (haute résolution)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Scale le contexte
    ctx.scale(dpr, dpr);
    
    // Fond blanc
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Style du trait
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    
    if (e.type.includes('touch')) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const signatureDataURL = canvas.toDataURL('image/png');
    onSave(signatureDataURL);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className="cursor-crosshair"
          style={{
            width: '100%',
            height: '200px',
            display: 'block',
            touchAction: 'none'
          }}
        />
      </div>
      <p className="text-sm text-gray-500 text-center">
        Signez dans la zone ci-dessus (utilisez votre souris ou votre doigt)
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={clearSignature}>
          Effacer
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={handleSave} style={{backgroundColor: '#0D2040'}}>
          Valider la signature
        </Button>
      </div>
    </div>
  );
}
