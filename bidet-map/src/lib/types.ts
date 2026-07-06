// nearby_buildings RPC 반환 행
export type NearbyBuilding = {
  id: string;
  name: string;
  address: string | null;
  place_type: string;
  accessibility: string;
  is_24h: boolean;
  lat: number;
  lng: number;
  distance_m: number;
  best_bidet_status: string | null;
  has_photo: boolean;
  last_verified_at: string | null;
};

export type RestroomDetail = {
  id: string;
  floor: string | null;
  area_desc: string | null;
  restroom_type: string;
  accessibility: string;
  bidet_location: string | null;
  bidet_status: string;
  amenities: string[];
  memo: string | null;
  last_verified_at: string | null;
  helpful_count: number;
  report_count: number;
  photos: string[];
};

export type BuildingDetail = {
  id: string;
  name: string;
  address: string | null;
  place_type: string;
  accessibility: string;
  is_24h: boolean;
  helpful_count: number;
  lat: number;
  lng: number;
  restrooms: RestroomDetail[];
};

export type NearbyFilters = {
  types?: string[];
  access?: string[];
  restroom?: string[];
  onlyWorking?: boolean;
  hasPhoto?: boolean;
  is24h?: boolean;
  recentDays?: number;
};
