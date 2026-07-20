"use client";

import {
MapContainer,
TileLayer,
Marker
} from "react-leaflet";

import "leaflet/dist/leaflet.css";


export default function AttendanceMap({
latitude,
longitude
}){


return(

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

url="
https://tile.openstreetmap.org/{z}/{x}/{y}.png
"

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