"use client";
// app/(app)/studio/address-field.jsx — Studio's adapter over the shared picker.
//
// The component itself now lives in components/AddressField.jsx so the project
// editor and the lead widget use the same one. Studio passes a whole `client`
// object around, so this maps that shape onto the shared props and keeps
// Studio's own input class.
import SharedAddressField from "../../../components/AddressField.jsx";

export default function AddressField({ lang, client, onPick }) {
  return (
    <SharedAddressField
      lang={lang}
      value={client.address}
      lat={client.lat}
      lng={client.lng}
      onPick={onPick}
      inputClassName="pv-input"
    />
  );
}
