import React, { useRef, useState } from "react";

export default function SignaturePad({ onSign, disabled }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e) {
    if (disabled) return;
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e) {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e2a4a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasDrawn(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasDrawn(false);
  }

  function confirm() {
    if (!hasDrawn) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSign(dataUrl);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="sig-pad"
        width={340}
        height={140}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button type="button" className="btn secondary small" onClick={clear} disabled={disabled}>
          Effacer
        </button>
        <button type="button" className="btn small" onClick={confirm} disabled={disabled || !hasDrawn}>
          Valider ma signature
        </button>
      </div>
    </div>
  );
}
