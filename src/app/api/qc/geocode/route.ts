import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { address } = await request.json();
    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`, {
      headers: {
        "User-Agent": "PristineQC/1.0 (contact: info@pristinecleaners.com)",
      },
    });

    if (!res.ok) {
      throw new Error("Failed to contact geocoding service");
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const { lat, lon } = data[0];
    return NextResponse.json({ lat: parseFloat(lat), lng: parseFloat(lon) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Geocoding failed" }, { status: 500 });
  }
}
