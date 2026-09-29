import { pitchRoom as cascade } from "./configs/cascade.js?v=20260928-44";

const rooms = { cascade };
const requestedRoom = new URLSearchParams(window.location.search).get("brand") || "cascade";

export const pitchRoom = rooms[requestedRoom] || cascade;
