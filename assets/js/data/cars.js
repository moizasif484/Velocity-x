/**
 * Velocity X — Car Data
 * Static dataset consumed by the car grid, detail panels and leaderboard.
 * Pure data only: no DOM access, no side effects.
 *
 * Units:
 *   horsepower   — bhp
 *   torque       — Nm
 *   topSpeed     — km/h
 *   acceleration — seconds, 0–100 km/h
 */

export const cars = [
  {
    id: 'vx-01-apex',
    name: 'Apex Zero',
    manufacturer: 'Velocity Dynamics',
    year: 2031,
    class: 'Hypercar',
    horsepower: 1420,
    torque: 1500,
    topSpeed: 412,
    acceleration: 2.1,
    drivetrain: 'AWD',
    paint: '#0b1220',
    accent: '#22d3ff',
    image: 'assets/img/cars/apex-zero.jpg',
    description:
      'The flagship of the Velocity X grid. A tri-motor carbon monocoque built around active aero that reshapes itself twice per second, trading downforce for drag the instant the road opens up.'
  },
  {
    id: 'vx-02-rune',
    name: 'Rune GTX',
    manufacturer: 'Halden Motorworks',
    year: 2030,
    class: 'Grand Tourer',
    horsepower: 940,
    torque: 1080,
    topSpeed: 356,
    acceleration: 2.8,
    drivetrain: 'AWD',
    paint: '#151b2e',
    accent: '#7c5cff',
    image: 'assets/img/cars/rune-gtx.jpg',
    description:
      'A continent-crossing missile. Adaptive magnetorheological suspension smooths broken tarmac at 300 km/h while the cabin stays quieter than most road cars at idle.'
  },
  {
    id: 'vx-03-kestrel',
    name: 'Kestrel R',
    manufacturer: 'Arcline',
    year: 2032,
    class: 'Track Weapon',
    horsepower: 780,
    torque: 820,
    topSpeed: 328,
    acceleration: 2.4,
    drivetrain: 'RWD',
    paint: '#0f172a',
    accent: '#f5d90a',
    image: 'assets/img/cars/kestrel-r.jpg',
    description:
      'Stripped to 1,040 kg and shaped entirely by the wind tunnel. No infotainment, no carpet, no compromise — just a fixed rear wing and a titanium roll structure.'
  },
  {
    id: 'vx-04-nomad',
    name: 'Nomad ST',
    manufacturer: 'Kaido Industries',
    year: 2029,
    class: 'Rally',
    horsepower: 620,
    torque: 760,
    topSpeed: 274,
    acceleration: 3.1,
    drivetrain: 'AWD',
    paint: '#1a2416',
    accent: '#4ade80',
    image: 'assets/img/cars/nomad-st.jpg',
    description:
      'Built for gravel, snow and everything the tarmac cars refuse. Long-travel dampers, a sealed underbody and a torque-vectoring rear axle that rotates the car on throttle alone.'
  },
  {
    id: 'vx-05-vantage',
    name: 'Vantage Drift',
    manufacturer: 'Sable Performance',
    year: 2030,
    class: 'Drift',
    horsepower: 850,
    torque: 980,
    topSpeed: 298,
    acceleration: 3.0,
    drivetrain: 'RWD',
    paint: '#2b0f1e',
    accent: '#ff2d78',
    image: 'assets/img/cars/vantage-drift.jpg',
    description:
      'Sixty-five degrees of steering lock and a hydraulic handbrake wired straight to the rear calipers. Angle is the point; lap time is somebody else\u2019s problem.'
  },
  {
    id: 'vx-06-solstice',
    name: 'Solstice LM',
    manufacturer: 'Perrin Racing',
    year: 2033,
    class: 'Endurance Prototype',
    horsepower: 1080,
    torque: 1240,
    topSpeed: 378,
    acceleration: 2.5,
    drivetrain: 'AWD',
    paint: '#101820',
    accent: '#ff8a3d',
    image: 'assets/img/cars/solstice-lm.jpg',
    description:
      'A 24-hour car. Energy recovery on both axles, brake-by-wire tuned for consistency over peak bite, and a driver-swap harness system that resets in under nine seconds.'
  },
  {
    id: 'vx-07-cinder',
    name: 'Cinder V8',
    manufacturer: 'Brandt & Roe',
    year: 2028,
    class: 'Muscle',
    horsepower: 710,
    torque: 940,
    topSpeed: 302,
    acceleration: 3.4,
    drivetrain: 'RWD',
    paint: '#1c1410',
    accent: '#e0442b',
    image: 'assets/img/cars/cinder-v8.jpg',
    description:
      'The last of the combustion holdouts on the grid. A supercharged 6.8-litre V8 with a synthetic-fuel tune, deliberately loud in a paddock that has otherwise gone silent.'
  },
  {
    id: 'vx-08-halo',
    name: 'Halo Prototype',
    manufacturer: 'Velocity Dynamics',
    year: 2034,
    class: 'Concept',
    horsepower: 1650,
    torque: 1720,
    topSpeed: 438,
    acceleration: 1.8,
    drivetrain: 'AWD',
    paint: '#070b14',
    accent: '#22d3ff',
    image: 'assets/img/cars/halo-prototype.jpg',
    description:
      'Quad-motor, solid-state, and technically not road legal anywhere. The Halo exists to prove the platform \u2014 every production Velocity X car inherits something from it.'
  },
  {
    id: 'vx-09-tessera',
    name: 'Tessera GT4',
    manufacturer: 'Arcline',
    year: 2031,
    class: 'Grand Tourer',
    horsepower: 660,
    torque: 720,
    topSpeed: 311,
    acceleration: 3.3,
    drivetrain: 'RWD',
    paint: '#122530',
    accent: '#38bdf8',
    image: 'assets/img/cars/tessera-gt4.jpg',
    description:
      'The entry point to competitive racing. Forgiving on the limit, cheap to rebuild, and quick enough that the driver \u2014 not the budget \u2014 decides the result.'
  },
  {
    id: 'vx-10-obsidian',
    name: 'Obsidian S',
    manufacturer: 'Kaido Industries',
    year: 2032,
    class: 'Hypercar',
    horsepower: 1240,
    torque: 1380,
    topSpeed: 396,
    acceleration: 2.2,
    drivetrain: 'AWD',
    paint: '#0a0a0f',
    accent: '#a78bfa',
    image: 'assets/img/cars/obsidian-s.jpg',
    description:
      'Wrapped in a light-absorbing composite that makes the bodywork read as a silhouette. Underneath sits an active roll-control system borrowed directly from the Solstice programme.'
  }
];

export const CARS = cars;

export const CAR_CLASSES = [...new Set(cars.map(car => car.class))];

export function getCarById(id) {
  return cars.find(car => car.id === id) || null;
}

export function sortCars(list = cars, sortBy = 'name') {
  const items = [...list];

  switch (sortBy) {
    case 'horsepower':
      return items.sort((a, b) => b.horsepower - a.horsepower);

    case 'topSpeed':
      return items.sort((a, b) => b.topSpeed - a.topSpeed);

    case 'year':
      return items.sort((a, b) => b.year - a.year);

    case 'name':
    default:
      return items.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function filterCars(list = cars, carClass = 'All') {
  if (!carClass || carClass === 'All') {
    return list;
  }

  return list.filter(car => car.class === carClass);
}

export default cars;