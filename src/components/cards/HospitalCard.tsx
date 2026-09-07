import type { Hospital } from "@/types/domain";

export function HospitalCard({ hospital }: { hospital: Hospital }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="font-medium text-gray-800">{hospital.name}</p>
      <p className="text-sm text-gray-500">{hospital.address}</p>
      {hospital.has24hEmergency && (
        <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          Open 24h emergency
        </span>
      )}
    </div>
  );
}
