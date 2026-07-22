import { ImageResponse } from 'next/og';

export const alt = "PhoneDock Pakistan — Smartphone prices, specs and reviews";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '76px',
          background: 'linear-gradient(135deg, #07111f 0%, #102a56 55%, #2563eb 100%)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 38, fontWeight: 700 }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, background: '#facc15', color: '#07111f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>P</div>
          PhoneDock Pakistan
        </div>
        <div style={{ marginTop: 54, maxWidth: 980, fontSize: 72, lineHeight: 1.05, fontWeight: 800 }}>
          Find the right phone with real specs and smarter comparisons.
        </div>
        <div style={{ marginTop: 34, fontSize: 30, color: '#dbeafe' }}>
          Prices • Specs • PTA status • Reviews • Buying tools
        </div>
      </div>
    ),
    size,
  );
}
