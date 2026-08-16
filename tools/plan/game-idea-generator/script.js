document.addEventListener('DOMContentLoaded', function() {
	function applyDashboardTheme(nextTheme) {
		document.body.setAttribute('data-dashboard-theme', nextTheme || 'fire');
		if (typeof window.applyDashboardThemeVars === 'function') {
			window.applyDashboardThemeVars(nextTheme || 'fire');
		}
	}
	const generateBtn = document.getElementById('generateBtn');
	const ideaText = document.querySelector('.idea-text');
	const ideaType = document.querySelector('.idea-type');
	const ideaDetails = document.querySelector('.idea-details ul');
	
	const genres = [
	  "Action",
	  "Platform game",
	  "Shooter game",
	  "First-person shooter",
	  "Hero shooter",
	  "Light gun shooter",
	  "Shoot 'em up",
	  "Fighting game",
	  "Beat 'em up game",
	  "Stealth game",
	  "Survival game",
	  "Rhythm game",
	  "Battle Royale game",
	  "Action-adventure",
	  "Survival horror",
	  "Metroidvania",
	  "Adventure",
	  "Text adventure",
	  "Graphic adventure",
	  "Visual novel",
	  "Interactive movie",
	  "Real-time 3D adventure",
	  "Puzzle",
	  "Breakout clone game",
	  "Logical game",
	  "Physics game",
	  "Programming game",
	  "Puzzle-platform game",
	  "Trial-and-error / exploration",
	  "Hidden object game",
	  "Reveal the picture game",
	  "Tile-matching game",
	  "Traditional puzzle game",
	  "Role-playing",
	  "Action RPG",
	  "CRPG",
	  "MMORPG",
	  "Roguelike",
	  "Tactical RPG",
	  "Sandbox RPG",
	  "First-person party-based RPG",
	  "Monster-taming",
	  "Simulation",
	  "Construction and management simulation",
	  "Life simulation",
	  "Vehicle simulation",
	  "Strategy",
	  "4X game",
	  "Artillery game",
	  "Auto battler",
	  "Multiplayer online battle arena",
	  "Real-time strategy",
	  "Real-time tactic",
	  "Tower defense",
	  "Turn-based strategy",
	  "Turn-based tactic",
	  "Wargame",
	  "Grand strategy wargame",
	  "Sport",
	  "Racing",
	  "Sports game",
	  "Competitive",
	  "Sports-based fighting",
	  "MMO",
	  "Board game",
	  "Card game",
	  "Parental Sim",
	  "Casino game",
	  "Digital collectible card game",
	  "Digital therapeutic video game",
	  "Gacha game",
	  "Horror game",
	  "Idle game",
	  "Party game",
	  "Photography game",
	  "Social deduction game",
	  "Trivia game",
	  "Typing game",
	  "Advergame",
	  "Art game",
	  "Casual game",
	  "Christian game",
	  "Educational game",
	  "Esport",
	  "Exergame",
	  "Personalized game",
	  "Serious game",
	  "Live Interactive Game",
	  "Sandbox",
	  "Creative",
	  "Open world"
	];

	const themes = [
		"Time Travel", "Space Exploration", "Underwater", "Post-Apocalyptic", 
		"Medieval", "Cyberpunk", "Steampunk", "Underground", "Dystopian", 
		"Mythical Creatures", "Mystery", "Island Survival", "Robotics", 
		"Ancient Civilizations", "Virtual Reality", "Magic", "War", 
		"Fairy Tale", "Superhero", "Detective", "Zombies", "Aliens",
		"Apocalyptic", "Alternate History", "Space Opera", "Cyberpunk", "Mythology",
		"Ancient Egypt", "Medieval Times", "Future Society", "Underwater World", "Space Station",
		"Post-Apocalyptic Earth", "Cyberpunk City", "Steampunk Era", "Dystopian Society", "Fantasy Realm",
		"Mystery Investigation", "Island Paradise", "Robotics Lab", "Ancient Ruins", "Virtual Museum",
		"Space Colony", "Underground Cave", "Historical London", "Fantasy Kingdom", "Time Loop"
	];

	const mechanics = [
		"Time Manipulation", "Physics-based Puzzles", "Resource Management", 
		"Stealth", "Co-op Gameplay", "Turn-based Combat", "Crafting System", 
		"Character Customization", "Economy System", "Roguelike Elements",
		"Multi-World Travel", "Memory Manipulation", "Emotional Bonds", 
		"Environmental Storytelling", "Skill Trees", "Level Building", 
		"Vehicle Combat", "Magic System", "Inventory Management", 
		"Dialogue Trees", "Building Mechanics", "Real-time Strategy", 
		"Procedural Generation", "Narrative Choice", "Character Progression",
		"Multiplayer Co-op", "Competitive PvP", "Social Interaction",
		"Augmented Reality", "Haptic Feedback", "Voice Recognition", "Crafting", 
		"Exploration", "Combat", "Puzzle Solving", "Storytelling", "Character Development",
		"Resource Gathering", "Building", "Trading", "Skill Learning", "Combat System",
		"Time Management", "Decision Making", "Strategy Planning", "Cooperation", "Competition",
		"Survival Mechanics", "Environmental Interaction", "Item Management", "Map Navigation",
		"Quest Completion", "Achievement System", "Progression Tracking", "Dynamic Events"
	];

	const settings = [
		"Ancient Egypt", "Future Mars Colony", "Underwater City", 
		"Medieval Castle", "Cyberpunk City", "Post-Apocalyptic Wasteland", 
		"Space Station", "Underground Cave System", "Historical London", 
		"Fantasy Kingdom", "Virtual Reality World", "Time Loop", 
		"Deep Space", "Island Paradise", "Suburban Neighborhood",
		"Underground Laboratory", "Ancient Ruins", "Space Station", 
		"Floating Islands", "Virtual Museum", "Dystopian City", 
		"Steampunk Workshop", "Post-Apocalyptic Desert", "Ancient Temple",
		"Underwater Research Station", "Space Colony", "Ancient Library",
		"Cyberpunk Subway", "Post-Apocalyptic City", "Medieval Village",
		"Virtual Reality Arena", "Steampunk Airship", "Time Travel Hub",
		"Ancient Observatory", "Space Mining Facility", "Underground City",
		"Cyberpunk Hospital", "Post-Apocalyptic Farm", "Medieval Tavern",
		"Virtual Reality Theme Park", "Steampunk Observatory", "Time Loop Laboratory",
		"Ancient Tomb", "Space Research Station", "Underwater Resort",
		"Cyberpunk Market", "Post-Apocalyptic Library", "Medieval Castle Siege",
		"Virtual Reality Training Center", "Steampunk Workshop", "Time Travel Museum"
	];

	const objectives = [
		// Basic objectives
		"save the World", "find the Missing Artifact", "survive the Night", 
		"discover the Truth", "escape from a Prison", "restore Peace", 
		"find Your Family", "Defeat the Villain", "Solve the Mystery", 
		"collect all items", "complete the quest", "become the champion", 
		"Restore the Ancient Power", "Save the Planet", "Uncover the Secret",
		"Find the Lost Civilization", "Stop the Catastrophe", "Restore the Balance",
		"Escape the Maze", "Defeat the Boss", "Collect All Treasures",
		"Rescue the Innocent", "Uncover the Conspiracy", "Save the Kingdom",
		
		// Dynamic combinations that will be replaced
		"Save the {theme} World", "Find the {theme} Artifact", "Survive the {theme} Night", 
		"Discover the {theme} Truth", "Escape from the {theme} Prison", "Restore {theme} Peace", 
		"Find Your {theme} Family", "Defeat the {theme} Villain", "Solve the {theme} Mystery", 
		"Collect All {theme} Items", "Complete the {theme} Quest", "Become the {theme} Champion", 
		"Restore the {theme} Power", "Save the {theme} Planet", "Uncover the {theme} Secret",
		"Find the Lost {theme} Civilization", "Stop the {theme} Catastrophe", "Restore the {theme} Balance",
		"Escape the {theme} Maze", "Defeat the {theme} Boss", "Collect All {theme} Treasures",
		"Rescue the {theme} Innocent", "Uncover the {theme} Conspiracy", "Save the {theme} Kingdom"
	];

	const characters = [
		"Hero", "Explorer", "Scientist", "Detective", "Warrior", 
		"Innovator", "Survivor", "Mystic", "Engineer", "Sorceress",
		"Knight", "Spy", "Pirate", "Alien", "Robot", "Time Traveler",
		"Archaeologist", "Sage", "Mercenary", "Villain", "Guardian",
		"Child", "Elder", "Maiden", "Wanderer", "Champion",
		"Leader", "Rebel", "Scholar", "Assassin", "Healer",
		"Merchant", "Artist", "Farmer", "Blacksmith", "Noble",
		"Outlaw", "Sailor", "Chef", "Farmer", "Alchemist",
		"Captain", "Wizard", "Ninja", "Samurai", "Barbarian",
		"Priest", "Monk", "Rogue", "Bard", "Druid",
		"Paladin", "Ranger", "Warlock", "Cleric", "Berserker",
		"Shaman", "Oracle", "Sorcerer", "Enchanter", "Illusionist",
		"Technician", "Cyborg", "Android", "Geneticist", "Architect",
		"Historian", "Philosopher", "Alchemist", "Engineer", "Inventor",
		"Diplomat", "Politician", "Merchant Lord", "King", "Queen",
		
		// Occupational/Profession-based characters
		"Acrobat", "Assassin", "Baker", "Bartender", "Bishop", 
		"Blacksmith", "Bounty Hunter", "Brigand", "Caretaker", "Carpenter",
		"Clerk", "Cook", "Courier", "Curator", "Dancer", 
		"Doctor", "Duelist", "Ensign", "Engineer", "Envoy",
		"Farmer", "Ferryman", "Fisherman", "Florist", "Gambler",
		"Gardener", "Geologist", "Guard", "Guide", "Herald",
		"Huntsman", "Innkeeper", "Jeweler", "Judge", "Keeper",
		"Librarian", "Lumberjack", "Magician", "Mariner", "Mason",
		"Merchant", "Minstrel", "Monk", "Nanny", "Navigator",
		"Noble", "Novice", "Orphan", "Outlaw", "Painter",
		"Paramedic", "Peasant", "Performer", "Physician", "Pilot",
		"Poet", "Priest", "Professor", "Racer", "Reaper",
		"Researcher", "Sailor", "Scribe", "Scout", "Servant",
		"Shaman", "Singer", "Smith", "Soldier", "Spy",
		"Steward", "Student", "Swordsman", "Tanner", "Teacher",
		"Thief", "Tinker", "Tutor", "Urchin", "Vagrant",
		"Village Chief", "Wanderer", "Warrior", "Witch", "Wizard",
		"Woodsman", "Yardkeeper", "Zookeeper",
		
		// Fantasy/Mythological characters
		"Adventurer", "Aeromancer", "Alchemist", "Ambassador", "Anarchist",
		"Anchorman", "Apprentice", "Architect", "Armorer", "Artificer",
		"Astrologer", "Astronomer", "Attendant", "Augur", "Aviator",
		"Baker", "Barber", "Barrister", "Bastard", "Battlemage",
		"Beastmaster", "Berserker", "Bishop", "Blackguard", "Blademaster",
		"Blessed", "Bounty Hunter", "Brigand", "Brawler", "Brewer",
		"Brigadier", "Broker", "Bureaucrat", "Butcher", "Cabinetmaker",
		"Caliph", "Cannibal", "Captain", "Cardinal", "Caravaner",
		"Carpenter", "Cartographer", "Catalyst", "Champion", "Chancellor",
		"Charlatan", "Charioteer", "Chef", "Chieftain", "Chief",
		"Chronomancer", "Chronicler", "Clerk", "Cleric", "Cobbler",
		"Collector", "Commander", "Commoner", "Conjurer", "Constable",
		"Consort", "Consultant", "Contessa", "Cook", "Corporal",
		"Cosmologist", "Courtier", "Crafter", "Criminal", "Crusader",
		"Curator", "Custodian", "Cutter", "Dancer", "Dark Mage",
		"Dart Thrower", "Deacon", "Dealer", "Defender", "Dervish",
		"Dictator", "Diplomat", "Disciple", "Diviner", "Doctor",
		"Doomsayer", "Doppelganger", "Dragonlord", "Druid", "Duelist",
		"Dung Collector", "Dungeon Master", "Dwarven Smith", "Elder", "Emperor",
		"Empress", "Enchantress", "Engineer", "Enlightened", "Entertainer",
		"Envoy", "Epicurean", "Erudite", "Estate Owner", "Exile",
		"Executor", "Expert", "Explorer", "Exterminator", "Eye of the Storm",
		"Falconer", "Farmer", "Farseer", "Ferryman", "Fetishist",
		"Fiddler", "Field Marshal", "Fighter", "Filcher", "Fire Mage",
		"Fisherman", "Fletcher", "Florist", "Florist", "Flutist",
		"Fortune Teller", "Fountain Keeper", "Fox", "Fugitive", "Futurist",
		"Gambler", "Gardener", "Gargoyle", "Gardener", "Gargoyle",
		"Giant", "Giant Slayer", "Gnome", "Goatherd", "Goldsmith",
		"Gourmet", "Grand Master", "Grandfather", "Grandmother", "Grave Digger",
		"Great Mage", "Guardian", "Guild Master", "Guru", "Gunner",
		"Hacker", "Halo", "Harbinger", "Harlequin", "Haruspex",
		"Hatchet Man", "Hawk", "Healer", "Heir", "Herbalist",
		"Heretic", "Hermit", "Hero", "Herald", "Hippie",
		"Historian", "Hoarder", "Honey Gatherer", "Hoodlum", "Horseman",
		"Horticulturist", "Hound", "Huckster", "Huntress", "Huntsman",
		"Hussar", "Hypnotist", "Ice Mage", "Idiot", "Idol",
		"Illusionist", "Infiltrator", "Inquisitor", "Instructor", "Instrumentalist",
		"Interceptor", "Interrogator", "Inventor", "Investigator", "Ironworker",
		"Jailer", "Jester", "Jeweler", "Journeyman", "Judge",
		"Juggler", "Jungle Guide", "Keeper", "King", "Knight",
		"Laborer", "Lancer", "Landowner", "Landsknecht", "Larva",
		"Layman", "Laywoman", "Lecturer", "Legionnaire", "Leprechaun",
		"Librarian", "Lich", "Lightbringer", "Linguist", "Lion",
		"Lizardman", "Lorekeeper", "Lore Master", "Lumberjack", "Lunatic",
		"Lyricist", "Mage", "Magician", "Magistrate", "Maid",
		"Majordomo", "Mama", "Mammoth", "Man-at-Arms", "Mandarin",
		"Marauder", "Marine", "Mariner", "Marquis", "Martyr",
		"Master", "Matriarch", "Maven", "Mender", "Mercenary",
		"Merchant", "Messenger", "Metalworker", "Midwife", "Militia",
		"Milliner", "Miner", "Minstrel", "Mistress", "Mole",
		"Monger", "Monk", "Monster", "Moocher", "Moorland Wanderer",
		"Mortician", "Moss", "Moth", "Moulder", "Mover",
		"Mugger", "Mule Driver", "Mummer", "Muse", "Musician",
		"Mystic", "Mythologist", "Nanny", "Narcissist", "Necromancer",
		"Noble", "Nobleman", "Noblewoman", "Nomad", "Nurse",
		"Oarsman", "Observer", "Occultist", "Ogre", "Old Man",
		"Old Woman", "Oracle", "Orator", "Orbiter", "Orderly",
		"Orphan", "Outlaw", "Outrider", "Outsider", "Overseer",
		"Pactmaker", "Pagan", "Pain Dealer", "Paladin", "Pallbearer",
		"Paparazzi", "Paragon", "Paradox", "Paragon", "Paramedic",
		"Parchment", "Pardoner", "Parsley", "Passenger", "Pastor",
		"Patron", "Patriot", "Patrolman", "Patriot", "Paver",
		"Paw", "Peach", "Peasant", "Peeper", "Pentacle",
		"Performer", "Persecutor", "Pervert", "Pest", "Pestilent",
		"Pestilence", "Petitioner", "Phantom", "Philosopher", "Phlebotomist",
		"Pianist", "Pilgrim", "Pilot", "Pioneer", "Pirate",
		"Pistol", "Plague", "Plague Doctor", "Plaguebearer", "Planter",
		"Planner", "Plunderer", "Poet", "Polearm", "Policeman",
		"Politician", "Ponderer", "Pontiff", "Pope", "Potion Maker",
		"Praetor", "Prankster", "Preacher", "Preceptor", "Predator",
		"Prelate", "Premier", "Presbyter", "President", "Presser",
		"Priest", "Princess", "Prince", "Princess", "Prisoner",
		"Professor", "Prophet", "Protagonist", "Protege", "Protector",
		"Providence", "Prowler", "Psychologist", "Pupil", "Puppeteer",
		"Puritan", "Purveyor", "Pyromancer", "Quartermaster", "Queen",
		"Rabbi", "Racer", "Raid", "Raid Leader", "Ranger",
		"Rascal", "Rat", "Raven", "Reaper", "Rebel",
		"Recluse", "Recon", "Reconnaissance", "Reformer", "Refrigerator",
		"Regent", "Reign", "Reincarnate", "Relic", "Remnant",
		"Reptile", "Rescuer", "Resident", "Restorer", "Retainer",
		"Rider", "Rift", "Rigger", "Rival", "Rogue"
	];
	
	const gameIdeas = [
		"A {genre} game where you {objective} in a {setting} using {mechanic} mechanics",
		"A {genre} game where players {objective} in a {setting} using {mechanic} mechanics",
		"A {genre} game that combines {mechanic} with {mechanic} to create unique gameplay",
		"A {genre} game featuring {mechanic} and {mechanic} mechanics in {setting}",
		"Players control a {character} in a {setting} {theme} world to {objective} using {mechanic}",
		"A {theme} {genre} experience where {mechanic} and {mechanic} blend together",
		"In a {setting} {theme} world, players must {objective} using {mechanic} to survive",
		"A {genre} adventure where {mechanic} is the core mechanic to {objective}",
		"A {genre} game with {mechanic} elements where players {objective} in {setting}",
		"Players {objective} in a {setting} using {mechanic} to overcome {mechanic} obstacles",
		"A {theme} {genre} game where players {objective} through {mechanic} challenges",
		"A {genre} game where {mechanic} and {mechanic} work together to {objective}",
		"In a {setting}, players {objective} using {mechanic} and {mechanic} mechanics",
		"A {genre} game where {mechanic} is the key to {objective} in {setting}",
		"Players {objective} in a {theme} {genre} world using {mechanic} and {mechanic} systems"
	];
	
	function getRandomElement(array) {
		return array[Math.floor(Math.random() * array.length)];
	}
	
	function applyGrammar(text) {
// 1. Fix "A" to "An" for vowels and words starting with a vocal 'R' (like RPG, RTS, RTT)
		// This regex looks for 'A' followed by any vowel OR a standalone 'R' at the start of a word
		// followed by another capital letter or the end of the word (acronym detection).
		text = text.replace(/\b[Aa]\s+([aeiouAEIOU]|[R|M](?=[A-Z\s]|$))/g, 'An $1');

// 2. Prevent "Game game" or "games game"
		// Collapses "Board game game" -> "Board game" or "Platform games game" -> "Platform games"
		text = text.replace(/\b(games?)\s+game\b/gi, '$1');
		return text;
}
	
	function generateGameIdea() {
const ideaTemplate = getRandomElement(gameIdeas);
let genre = getRandomElement(genres);
const theme = getRandomElement(themes);
		const mechanic1 = getRandomElement(mechanics);
		const remainingMechanics = mechanics.filter(m => m !== mechanic1);
		const mechanic2 = getRandomElement(remainingMechanics);
const setting = getRandomElement(settings);
const objective = getRandomElement(objectives);
const character = getRandomElement(characters);

// Check if genre already contains the word "game" (case insensitive)
const hasGameWord = genre.toLowerCase().includes("game");
const genreReplacement = hasGameWord ? genre : `${genre} game`;

let finalObjective = objective;
if (finalObjective.includes('{theme}')) finalObjective = finalObjective.replace('{theme}', theme);
if (finalObjective.includes('{setting}')) finalObjective = finalObjective.replace('{setting}', setting);
if (finalObjective.includes('{character}')) finalObjective = finalObjective.replace('{character}', character);

let generatedIdea = ideaTemplate
.replace("{genre}", genreReplacement)
.replace("{theme}", theme)
.replace("{mechanic}", mechanic1)
.replace("{setting}", setting)
.replace("{objective}", finalObjective)
.replace("{character}", character);

// Handle cases where we have two mechanics
if (generatedIdea.includes("{mechanic}")) {
generatedIdea = generatedIdea.replace("{mechanic}", mechanic2);
}
		
		// --- GRAMMAR & CLEANUP ---
		// 1. Ensure the genre is followed by "game" if it doesn't have it, 
		// but the regex will catch if we doubled up.
		if (!generatedIdea.toLowerCase().includes(genre.toLowerCase() + " game")) {
			 generatedIdea = generatedIdea.replace(genre, genre + " game");
		}

// Apply Grammar Fixes (A/An and casing)
generatedIdea = applyGrammar(generatedIdea);
generatedIdea = generatedIdea.charAt(0).toUpperCase() + generatedIdea.slice(1);

// Update UI
ideaText.textContent = generatedIdea;
ideaType.textContent = hasGameWord ? genre : genre + " Game";

const details = [
`Genre: ${genre}`,
`Setting: ${setting}`,
`Core Mechanics: ${mechanic1}${mechanic2 ? ` & ${mechanic2}` : ''}`,
`Target Platform: PC/Console`
];

ideaDetails.innerHTML = '';
details.forEach(detail => {
const li = document.createElement('li');
li.textContent = detail;
ideaDetails.appendChild(li);
});

const ideaBox = document.querySelector('.game-idea');
ideaBox.classList.remove('pulse');
void ideaBox.offsetWidth; 
ideaBox.classList.add('pulse');
}

generateGameIdea();
generateBtn.addEventListener('click', generateGameIdea);
document.addEventListener('keydown', function (event) {
if (event.key === ' ' || event.key === 'Enter') {
generateGameIdea();
}
});

function describeCurrentAssets() {
	const details = Array.from(ideaDetails.querySelectorAll('li')).map(node => node.textContent || '');
	const payload = {
		idea: ideaText.textContent || '',
		type: ideaType.textContent || '',
		details
	};
	const text = JSON.stringify(payload, null, 2);
	return [{
		kind: 'text',
		title: 'Game Idea JSON',
		fileName: 'game-idea.json',
		mimeType: 'application/json',
		textContent: text,
		previewKind: 'text',
		previewText: text,
		sourceDetail: 'Generated game idea prompt data.',
		metadata: { sourceTool: 'game-idea-generator', resourceFormat: 'game-idea-json' }
	}];
}

window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;

	if (typeof window.registerDashboardThemeSync === 'function') {
		window.registerDashboardThemeSync(applyDashboardTheme);
	} else {
		window.addEventListener('message', function(event) {
			const message = event && event.data;
			if (message && message.type === 'tool:theme') applyDashboardTheme(message.payload && message.payload.theme);
		});
		applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
	}
});
