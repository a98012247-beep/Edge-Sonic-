export interface Voice {
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName: string;
}

export interface TTSRequest {
  text: string;
  voice: string;
  pitch: string; // e.g. "+0Hz"
  rate: string;  // e.g. "+0%"
}
