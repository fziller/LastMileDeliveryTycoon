export type Stop = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  rewardCents?: number;
};

export type GameState = {
  stops: Stop[];
  order: string[]; // stop ids in delivery order
  city: string;
  createdAt: number;
  depot?: Stop;
  day?: number;
  completedRoute?: import('./lib/osm').RouteResult;
  activeRoute?: import('./lib/osm').RouteResult;
  elapsed?: number;
  balanceCents?: number;
  capacityUpgraded?: boolean;
  efficiencyUpgraded?: boolean;
  unlockedAreas?: string[];
  choosingOrders?: boolean;
  dayResult?: { revenueCents: number; costCents: number; profitCents: number };
};
