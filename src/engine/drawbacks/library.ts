import { Drawback, Tier } from "../drawback";
import { ALL_IMPLEMENTED, IMPLEMENTED_BY_ID } from "./implemented";

// Stub drawbacks: cataloged for the Codex but not yet wired into the engine.
// (`implemented: false`; game flow will reject if attempted in play.)

type Stub = {
  id: string;
  name: string;
  description: string;
  flavor?: string;
  tier: Tier;
  icon?: string;
};

const STUBS: Stub[] = [
  // EASY / TRIVIAL
  { id: "rook_buddies", name: "Rook Buddies", description: "Can't move rooks until they are connected (no pieces between them on home rank).", tier: 1, icon: "link" },
  { id: "skittish", name: "Skittish", description: "While in check, you must move your king.", tier: 1, icon: "alert" },
  { id: "separation_anxiety", name: "Separation Anxiety", description: "Pawns adjacent to your king can't move away from him.", tier: 1, icon: "shield" },
  { id: "crossing_the_rubicon", name: "Crossing the Rubicon", description: "Once a piece crosses to the opponent's half, it can't return.", tier: 2 },
  { id: "queen_disguise", name: "Queen Disguise", description: "Your queen is secretly either a rook or a bishop. Once you move it like one, you can't move it like the other.", tier: 2 },
  { id: "queen_bee", name: "Queen Bee", description: "Once you capture with your queen, you can no longer move queens.", tier: 2 },
  { id: "entrenched", name: "Entrenched", description: "Rooks can't move more than 2 squares.", tier: 2 },
  { id: "shadow_queen", name: "Shadow Queen", description: "Queen can only move to dark squares.", tier: 1 },
  { id: "horse_tranquilizer", name: "Horse Tranquilizer", description: "Knights can't capture.", tier: 1 },
  { id: "quit_horsing_around", name: "Quit Horsing Around", description: "If you moved a knight last move, you can't move a knight this move.", tier: 1 },
  { id: "royal_jubilee", name: "Royal Jubilee", description: "Whenever you capture a non-pawn, you must move your king or queen on the next move.", tier: 2 },
  { id: "number_of_the_beast", name: "Number of the Beast", description: "Can't move to the 6th rank.", tier: 1 },
  { id: "prima_donna", name: "Prima Donna", description: "Can't have more than one pawn on the same file.", tier: 2 },
  { id: "separation_church_state", name: "Separation of Church and State", description: "Can't move bishops next to a king and can't move king next to a bishop.", tier: 2 },
  { id: "escort_mission", name: "Escort Mission", description: "If your king can capture, it must.", tier: 2 },
  { id: "battle_fatigue", name: "Battle Fatigue", description: "After a piece captures, it can't capture again until it makes a non-capturing move.", tier: 2 },
  { id: "no_shuffling", name: "No Shuffling", description: "Rooks can't move sideways.", tier: 1 },
  { id: "outflanked", name: "Outflanked", description: "Can't capture on the rim (a/h files, 1/8 ranks). King capture is allowed anywhere.", tier: 2 },
  { id: "professional_courtesy", name: "Professional Courtesy", description: "Can't capture non-pawn pieces with same-type pieces.", tier: 2 },
  { id: "snipers", name: "Snipers", description: "Bishops can only capture from distance ≥ 4.", tier: 2 },
  { id: "diplomatic_immunity", name: "Diplomatic Immunity", description: "Can't capture a piece that just moved, unless that move was a capture.", tier: 2 },
  { id: "simplifier", name: "Simplifier", description: "If you can capture a piece with one of lesser or equal value, you must.", tier: 2 },
  { id: "femme_fatale", name: "Femme Fatale", description: "You can only capture the enemy king with your queen.", tier: 2 },

  // MEDIUM
  { id: "get_down_mr_president", name: "Get Down Mr. President", description: "Can't move your king while in check.", tier: 3 },
  { id: "power_cells", name: "Power Cells", description: "Can't move a piece farther than the number of pawns you have.", tier: 3 },
  { id: "unspooling", name: "Unspooling", description: "Total move distance budget = 100. When you run out, you lose.", tier: 3 },
  { id: "evil_twin", name: "Evil Twin", description: "If you can capture a piece with a same-type piece, you must.", tier: 3 },
  { id: "doctor_octopus", name: "Doctor Octopus", description: "Can only capture non-king pieces 8 times total.", tier: 3 },
  { id: "protected_pawns", name: "Protected Pawns", description: "Can only move pawns to defended squares.", tier: 3 },
  { id: "just_passing_through", name: "Just Passing Through", description: "Can't capture on a random rank.", tier: 2 },
  { id: "stay_at_home_mom", name: "Stay-at-Home Mom", description: "Queen can only move to your two home ranks.", tier: 3 },
  { id: "remorseful", name: "Remorseful", description: "Can't capture twice in a row.", tier: 2 },
  { id: "siege", name: "Siege", description: "Must take at least one of opponent's rooks by move 20, or you lose.", tier: 3 },
  { id: "shapeshifter", name: "Shapeshifter", description: "Queen starts as a bishop. When you capture a non-pawn, queen becomes a copy of that piece. Capturing a knight freezes her.", tier: 4 },
  { id: "conscientious_objectors", name: "Conscientious Objectors", description: "Can't capture with pawns.", tier: 2 },
  { id: "respectful", name: "Respectful", description: "Can't give check.", tier: 3 },
  { id: "horse_eats_first", name: "Horse Eats First", description: "As long as you have a knight, you can only capture with knights.", tier: 3 },
  { id: "punching_down", name: "Punching Down", description: "Pieces can't capture pieces worth more than them.", tier: 2 },
  { id: "elephants_fear_mice", name: "Elephants Fear Mice", description: "Non-pawns can't capture pawns.", tier: 3 },
  { id: "windup_toys", name: "Windup Toys", description: "After move 12, can't move knights or bishops.", tier: 3 },
  { id: "abstinence", name: "Abstinence", description: "If opponent ever has two same-type non-pawns adjacent, you lose.", tier: 4 },
  { id: "you_best_not_miss", name: "You Best Not Miss", description: "If you end your turn giving check, you must capture the king next turn or lose.", tier: 4 },
  { id: "eye_of_sauron", name: "Eye of Sauron", description: "As long as you have a rook, non-pawns can't go past the rook's farthest sight.", tier: 4 },
  { id: "savior_complex", name: "Savior Complex", description: "When in check, must move your queen, or lose.", tier: 4 },
  { id: "reconnaissance", name: "Reconnaissance", description: "Start unable to capture. Each turn, study piece types; after one turn, capture them for rest of game.", tier: 4 },
  { id: "control_center", name: "Control Center", description: "Non-capturing moves must go to files c, d, e, or f.", tier: 3 },
  { id: "haunted", name: "Haunted", description: "Can't move to a square where you've previously captured.", tier: 3 },
  { id: "tower_defense", name: "Tower Defense", description: "Can't move rooks. If you lose all rooks, you lose.", tier: 4 },
  { id: "paranoid", name: "Paranoid", description: "Your king must always be defended, or you lose.", tier: 4 },
  { id: "bipartisanship", name: "Bipartisanship", description: "Can't move left twice in a row or right twice in a row.", tier: 3 },
  { id: "shellshocked", name: "Shellshocked", description: "When opponent captures, pieces adjacent to the captured square can't move next turn.", tier: 3 },
  { id: "comfort_zone", name: "Comfort Zone", description: "If you can move to a random square X, you must.", tier: 2 },
  { id: "king_of_the_hill", name: "King of the Hill", description: "After turn 1, you lose if no piece is in the central 4 squares.", tier: 4 },
  { id: "lethal_attraction", name: "Lethal Attraction", description: "Can't make moves that move a piece farther from opponent's king than it started.", tier: 4 },
  { id: "modest", name: "Modest", description: "Lose if you have more pieces than opponent.", tier: 4 },
  { id: "triple_play", name: "Triple Play", description: "Can only capture the enemy king if you have 3 of a random piece type.", tier: 4 },
  { id: "sibling_rivalry", name: "Sibling Rivalry", description: "Can't move a piece adjacent to an opponent's piece of same type.", tier: 3 },
  { id: "torchlight", name: "Torchlight", description: "Non-pawns can only move if start or end square is adjacent to one of your pawns.", tier: 4 },
  { id: "turn_other_cheek", name: "Turn the Other Cheek", description: "Can't recapture.", tier: 3 },
  { id: "gambler", name: "Gambler", description: "Can't move a specific piece type, re-randomized each turn.", tier: 4 },
  { id: "blinded_by_sun", name: "Blinded by the Sun", description: "Can't end turn attacking a random square.", tier: 3 },
  { id: "bishop_fan_club", name: "Bishop Fan Club", description: "Must promote to bishops. King and queen can only move diagonally.", tier: 4 },
  { id: "chivalry", name: "Chivalry", description: "Can only capture heavies (rooks, queens) with a knight.", tier: 4 },
  { id: "spread_out", name: "Spread Out", description: "Can't move a non-pawn adjacent to another of your non-pawns. Can't castle.", tier: 4 },
  { id: "stop_stalling", name: "Stop Stalling", description: "Pieces can't move laterally.", tier: 3 },
  { id: "peons_first", name: "Peons First", description: "Can't move pieces that are one square behind one of your pawns.", tier: 3 },
  { id: "moving_day", name: "Moving Day", description: "After turn 20, no piece may be on your home row.", tier: 4 },
  { id: "oddball", name: "Oddball", description: "Can only capture on odd-numbered moves.", tier: 3 },
  { id: "even_keeled", name: "Even Keeled", description: "Can only capture on even-numbered moves.", tier: 3 },
  { id: "social_distancing", name: "Social Distancing", description: "Can't make non-capturing moves to squares adjacent to opponent pieces.", tier: 3 },
  { id: "far_sighted", name: "Far Sighted", description: "Pieces can't capture pieces adjacent to them.", tier: 3 },
  { id: "drag", name: "Drag", description: "Your queen IS a king. If captured, you lose.", tier: 4 },
  { id: "stir_crazy", name: "Stir Crazy", description: "If you haven't moved your king for 4 turns, you must on the 5th.", tier: 3 },
  { id: "rook_on_seventh", name: "Rook on the Seventh", description: "By move 15, you must have a rook on rank 7.", tier: 4 },
  { id: "guerilla_tactics", name: "Guerilla Tactics", description: "After a capturing move, you must return the capturing piece to its previous square if possible.", tier: 4 },
  { id: "cheerleaders", name: "Cheerleaders", description: "Non-pawns can only capture if adjacent to one of your pawns.", tier: 4 },
  { id: "scouting_ahead", name: "Scouting Ahead", description: "As long as you have a pawn, non-pawns can't go ahead of your most advanced pawn.", tier: 4 },
  { id: "spice_of_life", name: "Spice of Life", description: "Can't move same piece type twice in a row.", tier: 3 },
  { id: "warlord", name: "Warlord", description: "From turn 12 onward, your king can't be on the first two ranks.", tier: 4 },
  { id: "medusa", name: "Medusa", description: "Pieces attacked by opponent's queen are stone; they cannot move.", tier: 4 },
  { id: "fischer_random_endgame", name: "Fischer Random Endgame", description: "By move 20, all your non-pawns must be on home row AND on a square they couldn't have started on.", tier: 5 },
  { id: "centralized_command", name: "Centralized Command", description: "Can only capture if you moved your king in last 3 turns.", tier: 4 },
  { id: "stand_your_ground", name: "Stand Your Ground", description: "Pieces can only capture if attacked.", tier: 4 },

  // HARD
  { id: "always_check_it_might_be_mate", name: "Always Check, It Might Be Mate", description: "If you are checked, you lose.", tier: 5 },
  { id: "glorious_battle", name: "Glorious Battle", description: "Starting on a random move, for 4 consecutive moves, you must capture or lose.", tier: 5 },
  { id: "flatterer", name: "Flatterer", description: "If opponent moves a pawn, you must move a pawn. Same for non-pawns.", tier: 4 },
  { id: "messy_divorce", name: "Messy Divorce", description: "Pieces can't move from queenside to kingside or vice versa.", tier: 4 },
  { id: "leveling_up", name: "Leveling Up", description: "Can't capture a piece type until you've captured its predecessor.", tier: 5 },
  { id: "homeland_security", name: "Homeland Security", description: "If opponent enters your two home ranks, you lose.", tier: 5 },
  { id: "cowering_in_fear", name: "Cowering in Fear", description: "Can't move a piece of less value than one opponent has captured from you.", tier: 4 },
  { id: "barbarian_rage", name: "Barbarian Rage", description: "If you captured last move, you must capture this move if able.", tier: 4 },
  { id: "my_kingdom_for_a_horse", name: "My Kingdom for a Horse", description: "If opponent captures a knight of yours, you lose.", tier: 5 },
  { id: "eye_for_an_eye", name: "Eye for an Eye", description: "If opponent captures, you must capture next turn or lose.", tier: 4 },
  { id: "simon_says", name: "Simon Says", description: "Must move onto same color square as opponent's last move.", tier: 4 },
  { id: "irresistible", name: "Irresistible", description: "If you can move a piece adjacent to opponent's king (that isn't already), you must.", tier: 4 },
  { id: "boastful", name: "Boastful", description: "Lose if you have fewer pieces than opponent.", tier: 5 },
  { id: "winds_of_fate", name: "Winds of Fate", description: "Each turn, randomly can't move left or can't move right.", tier: 4 },
  { id: "monkey_see", name: "Monkey See", description: "Can only capture with piece types your opponent has captured with.", tier: 5 },
  { id: "true_love", name: "True Love", description: "King and queen can only move to squares adjacent to each other.", tier: 4 },
  { id: "superstitious", name: "Superstitious", description: "Can't move to a square where opponent has captured.", tier: 3 },
  { id: "eat_your_vegetables", name: "Eat Your Vegetables", description: "Can't capture non-pawns until opponent has ≤ 4 pawns remaining.", tier: 4 },
  { id: "bloodthirsty", name: "Bloodthirsty", description: "After turn 3, if you go 2 turns without capturing, you must capture or lose.", tier: 4 },
  { id: "left_for_dead", name: "Left for Dead", description: "Can only capture leftward.", tier: 4 },
  { id: "crusade", name: "Crusade", description: "For 4 moves starting on a random move, must end turn on a specific random square.", tier: 4 },
  { id: "fog_of_war_old", name: "Fog of War (extended)", description: "Hide opponent pieces entirely.", tier: 5, icon: "cloud-fog" },
  { id: "hedonic_treadmill", name: "Hedonic Treadmill", description: "Must move a piece at least as valuable as opponent's last moved piece.", tier: 4 },
  { id: "death_wish", name: "Death Wish", description: "If you can move king into check, you must.", tier: 4 },
  { id: "checkers", name: "Checkers", description: "Must capture if able.", tier: 4 },
  { id: "closed_book", name: "Closed Book", description: "Lose if you ever start a turn with an open file.", tier: 5 },
  { id: "fixation", name: "Fixation", description: "Pawn moves → pawn moves only; non-pawn → non-pawn only, until type switches.", tier: 4 },
  { id: "covering_fire", name: "Covering Fire", description: "Can only capture a piece if you can capture it two different ways.", tier: 4 },
  { id: "unlucky", name: "Unlucky", description: "Half the squares are unusable each turn, re-randomized.", tier: 5 },
  { id: "jumpy", name: "Jumpy", description: "When possible, must move an attacked piece.", tier: 4 },
  { id: "hopscotch", name: "Hopscotch", description: "Must alternate light/dark destination squares.", tier: 4 },
  { id: "leaps_and_bounds", name: "Leaps and Bounds", description: "Can't move a piece to a square adjacent to where it just was.", tier: 4 },
  { id: "colorblind", name: "Colorblind", description: "Can't move to one random color of squares, re-randomized each turn.", tier: 4 },
  { id: "inching_forward", name: "Inching Forward", description: "After turn 6, king must be in front of home rank. Required rank advances every 6 turns.", tier: 4 },
  { id: "ichthyophobe", name: "Ichthyophobe", description: "Can't make the move Stockfish would make.", tier: 5 },
  { id: "left_to_right", name: "Left to Right", description: "Unless you just moved to the rightmost file, must move right of your last move's destination.", tier: 4 },
  { id: "friendly_fire", name: "Friendly Fire", description: "Can only move to squares defended by another of your pieces.", tier: 4 },
  { id: "going_the_distance", name: "Going the Distance", description: "Must move at least as far as opponent's last move or lose.", tier: 4 },
  { id: "helicopter_parent", name: "Helicopter Parent", description: "Lose if you have an undefended pawn.", tier: 4 },
  { id: "exclusivity_clause", name: "Exclusivity Clause", description: "Can't move to squares more than one of your pieces can move to.", tier: 4 },
  { id: "relay_race", name: "Relay Race", description: "If you can move a piece adjacent to your last move's destination, you must.", tier: 4 },
  { id: "devil_on_shoulder", name: "Devil on Your Shoulder", description: "Disobey suggested bad moves 7 turns in a row → must obey on 8th.", tier: 5 },
  { id: "reflective", name: "Reflective", description: "Non-pawns must move to squares whose mirror across the center is occupied.", tier: 5 },
  { id: "alternator", name: "Alternator", description: "Must alternate pawn and non-pawn moves.", tier: 4 },

  // BRUTAL
  { id: "obsession", name: "Obsession", description: "Each turn, a random square. If you can move to it, you must.", tier: 5 },
  { id: "boxing_with_shadow", name: "Boxing with Shadow", description: "When opponent moves, if you can move to the square they vacated, you must.", tier: 5 },
  { id: "noble_steed", name: "Noble Steed", description: "Non-knight pieces can only move if adjacent to one of your knights.", tier: 5 },
  { id: "deer_in_headlights", name: "Deer in the Headlights", description: "Can't move pieces that are under attack.", tier: 5 },
  { id: "hold_them_back", name: "Hold Them Back", description: "Lose if any opponent pawn reaches your half of the board.", tier: 5 },
  { id: "taking_turns", name: "Taking Turns", description: "Can't move a piece type until you've moved every piece of that type once.", tier: 5 },

  // ADDITIONAL
  { id: "hand_and_gigabrain", name: "Hand and Gigabrain", description: "Must move the piece type Stockfish recommends.", tier: 5 },
  { id: "crenellations", name: "Crenellations", description: "Pawns can only move to a random color of squares.", tier: 4 },
  { id: "scent_of_blood", name: "The Scent of Blood", description: "Can't make a non-capturing move with a piece that can capture.", tier: 4 },
  { id: "leading_the_charge", name: "Leading the Charge", description: "As long as you have a knight, non-knights can't be ahead of your most advanced knight.", tier: 4 },
  { id: "active_volcano", name: "Active Volcano", description: "Can't move onto or orthogonally adjacent to a random square.", tier: 4 },
  { id: "nurturer", name: "Nurturer", description: "Can't capture the enemy king until you've promoted a pawn.", tier: 5 },
  { id: "prince_charming", name: "Prince Charming", description: "If your queen is attacked, must move a knight if possible.", tier: 4 },
  { id: "absolution", name: "Absolution", description: "After a non-bishop captures, it must start a turn adjacent to a bishop before it can capture again.", tier: 5 },
  { id: "quicksand", name: "Quicksand", description: "Middle ranks are quicksand. A piece that ends on the same middle-rank square twice in a row is stuck.", tier: 4 },
  { id: "rook_fan_club", name: "Rook Fan Club", description: "Must promote to rooks. King/queen can't move diagonally.", tier: 4 },
  { id: "ladies_first", name: "Ladies First", description: "Can only move king if you moved queen on previous turn.", tier: 4 },
  { id: "inside_the_lines", name: "Inside the Lines", description: "Can't move onto the rim (moves staying on rim are fine).", tier: 4 },
  { id: "bridge_over_troubled_water", name: "Bridge Over Troubled Water", description: "A river runs through the middle. Cross only via the center files.", tier: 5 },
  { id: "royal_berth", name: "Royal Berth", description: "Can't place a piece adjacent to your king.", tier: 4 },
  { id: "velociraptor", name: "Velociraptor", description: "Can only capture a piece type if opponent moved that type in their last 3 moves.", tier: 5 },
  { id: "secret_garden", name: "Secret Garden", description: "Two of your pawns have secret gardens. Don't trespass.", tier: 5 },
  { id: "thunderdome", name: "Thunderdome", description: "Center 16 squares are the thunderdome. Pieces enter; pieces rarely leave.", tier: 5 },
  { id: "indecisive", name: "Indecisive", description: "Pieces can't capture if they have multiple possible capture moves.", tier: 4 },
  { id: "unrequited_love", name: "Unrequited Love", description: "King can't move away from queen; queen can't move toward king.", tier: 5 },
  { id: "torpedoes", name: "Torpedoes", description: "If you made a non-capturing pawn move last turn and can move it again, you must.", tier: 4 },
  { id: "theocracy", name: "Theocracy", description: "On odd/even moves, can only capture with bishops.", tier: 4 },
  { id: "bottled_lightning", name: "Bottled Lightning", description: "If you can move your king, you must.", tier: 5 },
];

export const ALL_DRAWBACKS: Drawback[] = (() => {
  const out: Drawback[] = [...ALL_IMPLEMENTED];
  const seen = new Set(out.map((d) => d.id));
  for (const s of STUBS) {
    if (seen.has(s.id)) continue;
    out.push({ ...s, implemented: false });
  }
  return out;
})();

export const PLAYABLE_DRAWBACKS = ALL_IMPLEMENTED;

export function getDrawback(id: string): Drawback | undefined {
  return ALL_DRAWBACKS.find((d) => d.id === id);
}

export function getDrawbacksByTier(tier: Tier): Drawback[] {
  return ALL_DRAWBACKS.filter((d) => d.tier === tier);
}

export { IMPLEMENTED_BY_ID };
