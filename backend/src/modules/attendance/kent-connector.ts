/**
 * KentConnector — the swappable device-feed interface (docs/02 §4).
 * Implementations: MockKentConnector (now) → KentDbView | KentRestApi |
 * KentCsvDrop (Stage 0.6/Phase 1, once IT confirms the access method P0-T01).
 * The ingestion pipeline depends ONLY on this interface — swapping mock for
 * real Kent is one constructor change, zero pipeline changes.
 */

export interface RawSwipe {
  employeeNo: string;
  accessCard?: string;
  swipeTs: Date;
  doorCode: string;
  direction?: 'in' | 'out';
  swipeType?: string;
  receivedAt: Date;
}

export interface DeviceInfo {
  doorCode: string;
}

export interface KentConnector {
  /** All swipes RECEIVED after `since` (device buffering means swipe_ts may be older). */
  fetchSince(since: Date): Promise<RawSwipe[]>;
  listDevices(): Promise<DeviceInfo[]>;
}

/** Deterministic PRNG so mock data is reproducible run-to-run (no Date.now/Math.random). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockKentOptions {
  /** Employee e-codes to generate swipes for. */
  employeeNos: string[];
  /** The working day (local midnight) to simulate. */
  day: Date;
  seed?: number;
  /** Simulate an offline door: its swipes exist physically but never arrive (PP-9 drill). */
  offlineDoor?: string;
}

const DOORS = ['Seamless-Plant_S4', 'Seamless-Plant_G4', 'DIP-6_Main', 'Corporate_HO_1'] as const;

/**
 * MockKentConnector — realistic Kent/Astra behavior for development:
 * IN ~09:00±25min and OUT ~18:00±40min per employee, ~15% take a lunch pair,
 * ~10% punch at a different plant's door (the ATT-16 cross-plant case),
 * received_at lags swipe_ts by 0–20 min (device→cloud buffering).
 */
export class MockKentConnector implements KentConnector {
  private readonly swipes: RawSwipe[];

  constructor(opts: MockKentOptions) {
    const rand = mulberry32(opts.seed ?? 42);
    const dayStart = new Date(opts.day);
    dayStart.setHours(0, 0, 0, 0);
    const at = (minutesFromMidnight: number) => new Date(dayStart.getTime() + minutesFromMidnight * 60_000);
    const lag = (d: Date) => new Date(d.getTime() + Math.floor(rand() * 20) * 60_000);

    this.swipes = [];
    for (const employeeNo of opts.employeeNos) {
      const homeDoorIdx = Math.floor(rand() * DOORS.length);
      const crossPlant = rand() < 0.1;
      const door = DOORS[crossPlant ? (homeDoorIdx + 1) % DOORS.length : homeDoorIdx] ?? DOORS[0];

      const inTs = at(540 + Math.floor((rand() - 0.5) * 50)); // ~09:00 ± 25 min
      const outTs = at(1080 + Math.floor((rand() - 0.5) * 80)); // ~18:00 ± 40 min
      this.swipes.push(
        { employeeNo, swipeTs: inTs, doorCode: door, direction: 'in', swipeType: 'Astra', receivedAt: lag(inTs) },
        { employeeNo, swipeTs: outTs, doorCode: door, direction: 'out', swipeType: 'Astra', receivedAt: lag(outTs) },
      );

      if (rand() < 0.15) {
        const lunchOut = at(810 + Math.floor(rand() * 20)); // ~13:30
        const lunchIn = at(840 + Math.floor(rand() * 20)); // ~14:00
        this.swipes.push(
          { employeeNo, swipeTs: lunchOut, doorCode: door, direction: 'out', swipeType: 'Astra', receivedAt: lag(lunchOut) },
          { employeeNo, swipeTs: lunchIn, doorCode: door, direction: 'in', swipeType: 'Astra', receivedAt: lag(lunchIn) },
        );
      }
    }

    if (opts.offlineDoor !== undefined) {
      const offline = opts.offlineDoor;
      this.swipes = this.swipes.filter((s) => s.doorCode !== offline);
    }
  }

  fetchSince(since: Date): Promise<RawSwipe[]> {
    return Promise.resolve(this.swipes.filter((s) => s.receivedAt.getTime() > since.getTime()));
  }

  listDevices(): Promise<DeviceInfo[]> {
    return Promise.resolve(DOORS.map((doorCode) => ({ doorCode })));
  }
}
