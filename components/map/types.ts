export interface MapPoint {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  code: string;
  /** Omitted for non-household points (e.g. a delivery destination): the popup hides the bird line. */
  birdCount?: number;
  ownerName?: string;
  active: boolean;
  /** Popup link (household detail page). */
  href?: string;
}

export interface MapViewProps {
  points: readonly MapPoint[];
  /** Enables picking a location by clicking the map. */
  onPick?: (latitude: number, longitude: number) => void;
  /** Location chosen but not saved yet. */
  pending?: { latitude: number; longitude: number } | null;
  /** Fit the view to the points (default true). */
  fit?: boolean;
  /**
   * Full map interaction (default true, the /map page). Embedded maps pass false: no wheel zoom and,
   * on touch devices, no one-finger drag, so scrolling the page over the map scrolls the page.
   */
  interactive?: boolean;
  className?: string;
}
