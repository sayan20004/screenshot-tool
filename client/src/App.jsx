import React, { useState, useRef, useEffect } from 'react';
import { Camera, Download, ChevronLeft, Loader2, Maximize2, Monitor, Type, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';

// Background Gradients
const gradients = [
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
];

export default function App() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [subPages, setSubPages] = useState([]);

  // App States: 'input', 'crop', 'edit'
  const [viewState, setViewState] = useState('input');

  // Crop State
  const imageRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // Final cropped Image (Base64)
  const [croppedImage, setCroppedImage] = useState(null);

  // Editor State
  const [bgGradient, setBgGradient] = useState(gradients[4]);
  const [padding, setPadding] = useState(48);
  const [borderRadius, setBorderRadius] = useState(12);
  const [showMacFrame, setShowMacFrame] = useState(true);
  const [shadow, setShadow] = useState(30);

  // Text Overlays State
  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [draggingTextId, setDraggingTextId] = useState(null);
  const [textDragOrigin, setTextDragOrigin] = useState({ x: 0, y: 0 });

  const exportRef = useRef(null);

  const handleCapture = async (e, directUrl) => {
    if (e && e.preventDefault) e.preventDefault();
    const captureUrl = directUrl || url;
    if (!captureUrl) return;

    // basic format check
    let formattedUrl = captureUrl;
    if (!formattedUrl.startsWith('http')) {
      formattedUrl = 'https://' + formattedUrl;
      setUrl(formattedUrl);
    } else if (directUrl) {
      setUrl(directUrl);
    }

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formattedUrl })
      });

      const data = await res.json();
      if (data.success && data.image) {
        setScreenshot(data.image);
        setSubPages(data.subPages || []);
        setViewState('crop');
      } else {
        alert(data.error || 'Failed to capture screenshot');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend API. Is the server running?');
    } finally {
      setIsLoading(false);
    }
  };

  // Custom Cropper Logic
  const handleMouseDown = (e) => {
    e.preventDefault();
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCrop({ x, y, width: 0, height: 0 });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();

    // Constrain within image bounds
    let currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    let currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    setCrop({
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      width: Math.abs(currentX - startPos.x),
      height: Math.abs(currentY - startPos.y)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const applyCrop = () => {
    if (crop.width < 50 || crop.height < 50) {
      alert("Please select a larger area");
      return;
    }

    // the rendered image size vs actual image size scaling
    const imgEl = imageRef.current;
    if (!imgEl) return;

    const scaleX = imgEl.naturalWidth / imgEl.width;
    const scaleY = imgEl.naturalHeight / imgEl.height;

    const canvas = document.createElement('canvas');
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;

    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = screenshot;
    img.onload = () => {
      ctx.drawImage(
        img,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
      setCroppedImage(canvas.toDataURL('image/png'));
      setViewState('edit');
    };
  };

  // --- Text Overlay Event Handlers ---
  const handleAddText = () => {
    const newText = {
      id: Date.now().toString(),
      content: 'Double click to edit',
      x: 50,
      y: 50,
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: 600,
      color: '#ffffff',
    };
    setTexts([...texts, newText]);
    setSelectedTextId(newText.id);
  };

  const handleTextMouseDown = (e, id) => {
    e.stopPropagation();
    setSelectedTextId(id);
    setDraggingTextId(id);
    setTextDragOrigin({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleTextMouseMove = (e) => {
    if (!draggingTextId) return;
    const dx = e.clientX - textDragOrigin.x;
    const dy = e.clientY - textDragOrigin.y;

    setTexts(texts.map(t => {
      if (t.id === draggingTextId) {
        return { ...t, x: t.x + dx, y: t.y + dy };
      }
      return t;
    }));

    setTextDragOrigin({ x: e.clientX, y: e.clientY });
  };

  const handleTextMouseUp = () => {
    if (draggingTextId) {
      setDraggingTextId(null);
    }
  };

  const updateSelectedText = (key, value) => {
    setTexts(texts.map(t => t.id === selectedTextId ? { ...t, [key]: value } : t));
  };

  const deleteSelectedText = () => {
    setTexts(texts.filter(t => t.id !== selectedTextId));
    setSelectedTextId(null);
  };

  const handleExport = async () => {
    if (!exportRef.current) return;

    // Wait for frames to render fully, especially shadows
    await new Promise(r => setTimeout(r, 100));

    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2, // High DPI
        backgroundColor: null, // Transparent background
        useCORS: true
      });

      const link = document.createElement('a');
      link.download = `screenshot-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('Failed to export image');
    }
  };

  return (
    <div className="app-container">
      {viewState === 'input' && (
        <div className="hero">
          <h1>
            Capture the Web.<br />
            <span className="text-gradient">Make it Beautiful.</span>
          </h1>
          <p>Instantly turn any website into a stunning, shareable presentation.</p>

          <form className="input-container glass" onSubmit={handleCapture}>
            <input
              type="text"
              className="url-input"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" className="btn-primary" disabled={isLoading || !url}>
              {isLoading ? <Loader2 className="animate-spin text-black" size={20} /> : <Camera size={20} />}
              Capture
            </button>
          </form>

          <footer className="landing-footer">
            <p>Site crafted by Sayan Maity</p>
            <div className="social-links">
              <a href="https://sayanmaity.me" target="_blank" rel="noopener noreferrer">Portfolio</a>
              <a href="https://x.com/sayanwas?s=21" target="_blank" rel="noopener noreferrer">X(Twitter)</a>
              <a href="https://github.com/sayan20004" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://www.linkedin.com/in/sayan-maitydev?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            </div>
          </footer>
        </div>
      )}

      {viewState === 'crop' && (
        <div className="view-container">
          <div className="view-header">
            <button className="back-btn" onClick={() => setViewState('input')} style={{ width: '140px' }}>
              <ChevronLeft size={20} /> Start Over
            </button>

            <div style={{ flex: 1, maxWidth: '600px', margin: '0 1rem', position: 'relative' }}>
              <select
                className="url-input glass"
                style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', margin: 0, height: '44px', appearance: 'none', cursor: 'pointer' }}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  handleCapture(null, e.target.value);
                }}
                disabled={isLoading || subPages.length === 0}
              >
                <option value="" disabled>Select a subpage...</option>
                {subPages.map((pageUrl, idx) => {
                  const origin = new URL(url).origin;
                  const isHome = pageUrl === origin || pageUrl === `${origin}/`;
                  const label = isHome ? '🏠 Home / Landing Page' : pageUrl.replace(origin, '');
                  return (
                    <option key={idx} value={pageUrl}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.5)' }}>
                ▼
              </div>
            </div>

            <button className="btn-primary" onClick={applyCrop} disabled={crop.width < 10} style={{ width: '180px' }}>
              <Monitor size={20} /> Frame Selection
            </button>
          </div>

          <div className="glass" style={{ padding: '1rem', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
            {isLoading && (
              <div className="loading-overlay">
                <Loader2 className="animate-spin text-accent" size={48} />
                <p style={{ marginTop: '1rem', fontWeight: 600 }}>Capturing preview...</p>
              </div>
            )}
            <div
              className="cropper-area"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img ref={imageRef} src={screenshot} alt="Website Screenshot" />
              <div className="crop-overlay"></div>

              {/* Highlight chosen area */}
              {crop.width > 0 && crop.height > 0 && (
                <div
                  className="crop-selection"
                  style={{
                    left: crop.x,
                    top: crop.y,
                    width: crop.width,
                    height: crop.height,
                    backgroundImage: `url(${screenshot})`,
                    backgroundPosition: `-${crop.x}px -${crop.y}px`,
                    backgroundSize: `${imageRef.current?.width || 0}px ${imageRef.current?.height || 0}px`,
                    backgroundRepeat: 'no-repeat'
                  }}
                />
              )}
            </div>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Drag to select the specific area of the website you want to highlight.</p>
        </div>
      )}

      {viewState === 'edit' && (
        <div className="view-container">
          <div className="view-header">
            <button className="back-btn" onClick={() => setViewState('crop')} style={{ width: '140px' }}>
              <ChevronLeft size={20} /> Back to Crop
            </button>

            <div style={{ flex: 1, maxWidth: '600px', margin: '0 1rem', position: 'relative' }}>
              <select
                className="url-input glass"
                style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', margin: 0, height: '44px', appearance: 'none', cursor: 'pointer' }}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  handleCapture(null, e.target.value);
                }}
                disabled={isLoading || subPages.length === 0}
              >
                <option value="" disabled>Select a subpage...</option>
                {subPages.map((pageUrl, idx) => {
                  const origin = new URL(url).origin;
                  const isHome = pageUrl === origin || pageUrl === `${origin}/`;
                  const label = isHome ? '🏠 Home / Landing Page' : pageUrl.replace(origin, '');
                  return (
                    <option key={idx} value={pageUrl}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.5)' }}>
                ▼
              </div>
            </div>

            <button className="btn-primary" onClick={handleExport} style={{ width: '150px' }}>
              <Download size={20} /> Export PNG
            </button>
          </div>

          <div className="editor-layout">
            <div className="glass canvas-container" style={{ position: 'relative', overflow: 'hidden' }}>
              {isLoading && (
                <div className="loading-overlay">
                  <Loader2 className="animate-spin text-accent" size={48} />
                  <p style={{ marginTop: '1rem', fontWeight: 600 }}>Capturing preview...</p>
                </div>
              )}
              {/* The exportable region */}
              <div
                ref={exportRef}
                className="composed-image"
                style={{
                  background: bgGradient,
                  padding: `${padding}px`,
                }}
                onMouseMove={handleTextMouseMove}
                onMouseUp={handleTextMouseUp}
                onMouseLeave={handleTextMouseUp}
                onClick={(e) => {
                  if (!e.target.closest('.text-overlay')) {
                    setSelectedTextId(null);
                  }
                }}
              >
                <div
                  className="composed-frame"
                  style={{
                    borderRadius: `${borderRadius}px`,
                    boxShadow: `0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)`,
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  {showMacFrame && (
                    <div className="mac-titlebar">
                      <div className="mac-dot red"></div>
                      <div className="mac-dot yellow"></div>
                      <div className="mac-dot green"></div>
                    </div>
                  )}
                  <img src={croppedImage} alt="Cropped Result" style={{ display: 'block' }} />

                  {texts.map((t) => (
                    <div
                      key={t.id}
                      className={`text-overlay ${selectedTextId === t.id ? 'selected' : ''}`}
                      style={{
                        left: t.x,
                        top: t.y,
                        fontFamily: t.fontFamily,
                        fontSize: `${t.fontSize}px`,
                        fontWeight: t.fontWeight,
                        color: t.color,
                      }}
                      onMouseDown={(e) => handleTextMouseDown(e, t.id)}
                    >
                      {t.content}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass controls-sidebar">
              <div className="control-group">
                <label>Background</label>
                <div className="color-presets">
                  {gradients.map((grad, i) => (
                    <button
                      key={i}
                      className={`color-btn ${bgGradient === grad ? 'active' : ''}`}
                      style={{ background: grad }}
                      onClick={() => setBgGradient(grad)}
                    />
                  ))}
                  <button
                    className={`color-btn ${bgGradient === 'transparent' ? 'active' : ''}`}
                    style={{ background: '#1e293b', borderStyle: 'dashed' }}
                    onClick={() => setBgGradient('transparent')}
                    title="Transparent Background"
                  />
                </div>
              </div>

              <div className="control-group">
                <label>Padding ({padding}px)</label>
                <input
                  type="range"
                  className="slider"
                  min="0" max="120" step="4"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                />
              </div>

              <div className="control-group">
                <label>Corner Radius ({borderRadius}px)</label>
                <input
                  type="range"
                  className="slider"
                  min="0" max="40" step="2"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(Number(e.target.value))}
                />
              </div>

              <div className="control-group">
                <label>Shadow Depth ({shadow}px)</label>
                <input
                  type="range"
                  className="slider"
                  min="0" max="80" step="10"
                  value={shadow}
                  onChange={(e) => setShadow(Number(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="toggle-container">
                  <label>Browser Frame</label>
                  <input
                    type="checkbox"
                    checked={showMacFrame}
                    onChange={(e) => setShowMacFrame(e.target.checked)}
                  />
                </div>
              </div>

              <hr style={{ border: '1px solid rgba(255,255,255,0.1)', width: '100%', margin: '0.5rem 0' }} />

              <div className="control-group">
                <button className="btn-primary" onClick={handleAddText} style={{ padding: '0.75rem', justifyContent: 'center' }}>
                  <Type size={18} /> Add Text
                </button>
              </div>

              {selectedTextId && (
                <div className="text-settings-panel">
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>
                    EDIT TEXT
                  </label>

                  <textarea
                    className="text-input-field"
                    value={texts.find(t => t.id === selectedTextId)?.content || ''}
                    onChange={(e) => updateSelectedText('content', e.target.value)}
                    placeholder="Enter text..."
                  />

                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Font</label>
                    <select
                      className="font-select"
                      value={texts.find(t => t.id === selectedTextId)?.fontFamily || 'Inter'}
                      onChange={(e) => updateSelectedText('fontFamily', e.target.value)}
                    >
                      <option value="Inter">Inter</option>
                      <option value="'Playfair Display', serif">Playfair Display</option>
                      <option value="'Space Mono', monospace">Space Mono</option>
                      <option value="'Montserrat', sans-serif">Montserrat</option>
                      <option value="'Pacifico', cursive">Pacifico</option>
                      <option value="'Bebas Neue', cursive">Bebas Neue</option>
                      <option value="'Dancing Script', cursive">Dancing Script</option>
                    </select>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Size</label>
                    <input
                      type="range"
                      className="slider"
                      min="12" max="120" step="2"
                      value={texts.find(t => t.id === selectedTextId)?.fontSize || 32}
                      onChange={(e) => updateSelectedText('fontSize', Number(e.target.value))}
                    />
                  </div>

                  <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Color</label>
                      <input
                        type="color"
                        value={texts.find(t => t.id === selectedTextId)?.color || '#ffffff'}
                        onChange={(e) => updateSelectedText('color', e.target.value)}
                        style={{ width: '100%', height: '36px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Weight</label>
                      <select
                        className="font-select"
                        value={texts.find(t => t.id === selectedTextId)?.fontWeight || 600}
                        onChange={(e) => updateSelectedText('fontWeight', Number(e.target.value))}
                      >
                        <option value={400}>Regular</option>
                        <option value={600}>Semibold</option>
                        <option value={800}>Bold</option>
                      </select>
                    </div>
                  </div>

                  <button className="btn-danger" onClick={deleteSelectedText} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
