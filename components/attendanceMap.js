"use client";

import { useEffect, useState } from "react";

export default function AttendanceMap({
  latitude,
  longitude
}) {

  const [MapComponents, setMapComponents] = useState(null);


  useEffect(() => {

    async function loadMap() {

      // Import Leaflet only in browser
      const L = await import("leaflet");

      // Fix marker icon
      delete L.default.Icon.Default.prototype._getIconUrl;

      L.default.Icon.Default.mergeOptions({

        iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",

        iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",

        shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"

      });


      const leaflet =
      await import("react-leaflet");


      await import("leaflet/dist/leaflet.css");


      setMapComponents(leaflet);

    }


    loadMap();

  }, []);



  if (!MapComponents) {
    return <div>Loading map...</div>;
  }



  const {
    MapContainer,
    TileLayer,
    Marker
  } = MapComponents;



  return (

    <MapContainer

      center={[
        latitude,
        longitude
      ]}

      zoom={16}

      style={{
        height:"350px",
        width:"100%"
      }}

    >

      <TileLayer

        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"

      />


      <Marker

        position={[
          latitude,
          longitude
        ]}

      />


    </MapContainer>

  );

}