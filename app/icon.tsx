import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "linear-gradient(135deg, #0f1c1a 0%, #0d2420 100%)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 18,
          fontWeight: 700,
          color: "#00ffcc",
        }}
      >
        V
      </div>
    ),
    { ...size },
  );
}
