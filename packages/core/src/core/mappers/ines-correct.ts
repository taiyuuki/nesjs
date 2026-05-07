/*
 * ROM database entry for mapper corrections, forked from fceux.
 */
export type ROMDBEntry = [crc32: number, mapper: number]

// ROM database for mapper corrections (CRC32 -> correct mapper)
export const ROM_DATABASE: ROMDBEntry[] = [
    [0xfcdaca80, 0], // Elevator Action */
    [0xc05a365b, 0], // Exed Exes (J) */
    [0x32fa246f, 0], // Tag Team Pro Wrestling */
    [0xb3c30bea, 0], // Xevious (J) */
    [0xe492d45a, 0], // Zippy Race */
    [0xe28f2596, 0], // Pac Land (J) */
    [0xd8ee7669, 1], // Adventures of Rad Gravity */
    [0x5b837e8d, 1], // Alien Syndrome */
    [0x37ba3261, 1], // Back to the Future 2 and 3 */
    [0x5b6ca654, 1], // Barbie rev X*/
    [0x61a852ea, 1], // Battle Stadium - Senbatsu Pro Yak
    [0xf6fa4453, 1], // Bigfoot */
    [0x391aa1b8, 1], // Bloody Warriors (J) */
    [0xa5e8d2cd, 1], // Breakthru */
    [0x3f56a392, 1], // Captain Ed (J) */
    [0x078ced30, 1], // Choujin - Ultra Baseball */
    [0xfe364be5, 1], // Deep Dungeon 4 */
    [0x57c12280, 1], // Demon Sword */
    [0xd09b74dc, 1], // Great Tank (J) */
    [0xe8baa782, 1], // Gun Hed (J) */
    [0x970bd9c2, 1], // Hanjuku Hero */
    [0xcd7a2fd7, 1], // Hanjuku Hero */
    [0x63469396, 1], // Hokuto no Ken 4 */
    [0xe94d5181, 1], // Mirai Senshi - Lios */
    [0x7156cb4d, 1], // Muppet Adventure Carnival thingy 
    [0x70f67ab7, 1], // Musashi no Bouken */
    [0x291bcd7d, 1], // Pachio Kun 2 */
    [0xa9a4ea4c, 1], // Satomi Hakkenden */
    [0xcc3544b0, 1], // Triathron */
    [0x934db14a, 1], // All-Pro Basketball */
    [0xf74dfc91, 1], // Win, Lose, or Draw */
    [0x9ea1dc76, 2], // Rainbow Islands */
    [0x6d65cac6, 2], // Terra Cresta */
    [0xe1b260da, 2], // Argos no Senshi */
    [0x1d0f4d6b, 2], // Black Bass thinging */
    [0x266ce198, 2], // City Adventure Touch */
    [0x804f898a, 2], // Dragon Unit */
    [0x55773880, 2], // Gilligan's Island */
    [0x6e0eb43e, 2], // Puss n Boots */
    [0x2bb6a0f8, 2], // Sherlock Holmes */
    [0x28c11d24, 2], // Sukeban Deka */
    [0x02863604, 2], // Sukeban Deka */
    [0x419461d0, 2], // Super Cars */
    [0xdbf90772, 3], // Alpha Mission */
    [0xd858033d, 3], // Armored Scrum Object */
    [0x9bde3267, 3], // Adventures of Dino Riki */
    [0xd8eff0df, 3], // Gradius (J) */
    [0x1d41cc8c, 3], // Gyruss */
    [0xcf322bb3, 3], // John Elway's Quarterback */
    [0xb5d28ea2, 3], // Mystery Quest - mapper 3?*/
    [0x02cc3973, 3], // Ninja Kid */
    [0xbc065fc3, 3], // Pipe Dream */
    [0xc9ee15a7, 3], // 3 is probably best.  41 WILL NOT 
    [0x13e09d7a, 4], // Dragon Wars (U) (proto) - comes wi
    [0x22d6d5bd, 4],
    [0xd97c31b0, 4], // Rasaaru Ishii no Childs Quest (J)
    [0x404b2e8b, 4], // Rad Racer 2 */
    [0x15141401, 4], // Asmik Kun Land */
    [0x4cccd878, 4], // Cat Ninden Teyandee */
    [0x59280bec, 4], // Jackie Chan */
    [0x7474ac92, 4], // Kabuki: Quantum Fighter */
    [0x5337f73c, 4], // Niji no Silk Road */
    [0x9eefb4b4, 4], // Pachi Slot Adventure 2 */
    [0x21a653c7, 4], // Super Sky Kid */
    [0x9cbadc25, 5], // JustBreed */
    [0xf518dd58, 7], // Captain Skyhawk */
    [0x84382231, 9], // Punch Out (J) */
    [0xbe939fce, 9], // Punchout*/
    [0x345d3a1a, 11], // Castle of Deceit */
    [0x5e66eaea, 13], // Videomation */
    [0xcd373baa, 14], // Samurai Spirits (Rex Soft) */
    [0xbfc7a2e9, 16],
    [0x6e68e31a, 16], // Dragon Ball 3*/
    [0x33b899c9, 16], // Dragon Ball - Dai Maou Fukkatsu (
    [0xa262a81f, 16], // Rokudenashi Blues (J) */
    [0xe4a291ce, 23], // World Hero (Unl) [!] */
    [0x51e9cd33, 23], // World Hero (Unl) [b1] */
    [0x105dd586, 27], // Mi Hun Che variations... */
    [0xbc9bb6c1, 27], // -- */
    [0x43753886, 27], // -- */
    [0x5b3de3d1, 27], // -- */
    [0x511e73f8, 27], // -- */
    [0x5555fca3, 32],
    [0x283ad224, 32], // Ai Sensei no Oshiete */
    [0x243a8735, 32], // Major League */
    [0xbc7b1d0f, 33], // Bakushou!! Jinsei Gekijou 2 (J) [
    [0xc2730c30, 34], // Deadly Towers */
    [0x4c7c1af3, 34], // Caesar's Palace */
    [0x932ff06e, 34], // Classic Concentration */
    [0xf46ef39a, 37], // Super Mario Bros. + Tetris + Nint
    [0x7ccb12a3, 43], // SMB2j */
    [0x6c71feae, 45], // Kunio 8-in-1 */
    [0xe2c94bc2, 48], // Super Bros 8 (Unl) [!] */
    [0xaebd6549, 48], // Bakushou!! Jinsei Gekijou 3 */
    [0x6cdc0cd9, 48], // Bubble Bobble 2 */
    [0x99c395f9, 48], // Captain Saver */
    [0xa7b0536c, 48], // Don Doko Don 2 */
    [0x40c0ad47, 48], // Flintstones 2 */
    [0x1500e835, 48], // Jetsons (J) */
    [0xa912b064, 51], // 11-in-1 Ball Games (has CHR ROM w
    [0xb19a55dd, 64], // Road Runner */
    [0xf92be3ec, 64], // Rolling Thunder */
    [0xe84274c5, 66],
    [0xbde3ae9b, 66], // Doraemon */
    [0x9552e8df, 66], // Dragon Ball */
    [0x811f06d9, 66], // Dragon Power */
    [0xd26efd78, 66], // SMB Duck Hunt */
    [0xdd8ed0f7, 70], // Kamen Rider Club */
    [0xbba58be5, 70], // Family Trainer - Manhattan Police
    [0x370ceb65, 70], // Family Trainer - Meiro Dai Sakuse
    [0xe62e3382, 71], // Mig-29 Soviet Fighter */
    [0xac7b0742, 71], // Golden KTV (Ch) [!], not actually
    [0x054bd3e9, 74], // Di 4 Ci - Ji Qi Ren Dai Zhan (As)
    [0x496ac8f7, 74], // Ji Jia Zhan Shi (As) */
    [0xae854cef, 74], // Jia A Fung Yun (Chinese) */
    [0x3d1c3137, 78], // Uchuusen - Cosmo Carrier */
    [0xa4fbb438, 79],
    [0xd4a76b07, 79], // F-15 City Wars*/
    [0x1eb4a920, 79], // Double Strike */
    [0x3e1271d5, 79], // Tiles of Fate */
    [0x0da5e32e, 87], // Urusei Yatsura */
    [0xd2699893, 88], //  Dragon Spirit */
    [0xbb7c5f7a, 89], // Mito Koumon or something similar 
    [0x8eab381c, 113], // Death Bots */
    [0x6a03d3f3, 114],
    [0x0d98db53, 114], // Pocahontas */
    [0x4e7729ff, 114], // Super Donkey Kong */
    [0xc5e5c5b2, 115], // Bao Qing Tian (As).nes */
    [0xa1dc16c0, 116],
    [0xe40dfb7e, 116], // Somari (P conf.) */
    [0xc9371ebb, 116], // Somari (W conf.) */
    [0xcbf4366f, 118], // Alien Syndrome (U.S. unlicensed) 
    [0x78b657ac, 118], // Armadillo */
    [0x90c773c1, 118], // Goal! 2 */
    [0xb9b4d9e0, 118], // NES Play Action Football */
    [0x07d92c31, 118], // RPG Jinsei Game */
    [0x37b62d04, 118], // Ys 3 */
    [0x318e5502, 121], // Sonic 3D Blast 6 (Unl) */
    [0xddcfb058, 121], // Street Fighter Zero 2 '97 (Unl) [
    [0x5aefbc94, 133], // Jovial Race (Sachen) [a1][!] */
    [0xc2df0a00, 140], // Bio Senshi Dan(hacked) */
    [0xe46b1c5d, 140], // Mississippi Satsujin Jiken */
    [0x3293afea, 140], // Mississippi Satsujin Jiken */
    [0x6bc65d7e, 140], // Youkai Club*/
    [0x5caa3e61, 144], // Death Race */
    [0x48239b42, 146], // Mahjong Companion (Sachen) [!] */
    [0xb6a727fa, 146], // Papillion (As) [!] */
    [0xa62b79e1, 146], // Side Winder (HES) [!] */
    [0xcc868d4e, 149], // 16 Mahjong [p1][!] */
    [0x29582ca1, 150],
    [0x40dbf7a2, 150],
    [0x73fb55ac, 150], // 2-in-1 Cosmo Cop + Cyber Monster 
    [0xddcbda16, 150], // 2-in-1 Tough Cop + Super Tough Co
    [0x47918d84, 150], // auto-upturn */
    [0x0f141525, 152], // Arkanoid 2 (Japanese) */
    [0xbda8f8e4, 152], // Gegege no Kitarou 2 */
    [0xb1a94b82, 152], // Pocket Zaurus */
    [0x026c5fca, 152], // Saint Seiya Ougon Densetsu */
    [0x3f15d20d, 153], // Famicom Jump 2 */
    [0xd1691028, 154], // Devil Man */
    [0xcfd4a281, 155], // Money Game.  Yay for money! */
    [0x2f27cdef, 155], // Tatakae!! Rahmen Man */
    [0xccc03440, 156],
    [0x983d8175, 157], // Datach Battle Rush */
    [0x894efdbc, 157], // Datach Crayon Shin Chan */
    [0x19e81461, 157], // Datach DBZ */
    [0xbe06853f, 157], // Datach J-League */
    [0x0be0a328, 157], // Datach SD Gundam Wars */
    [0x5b457641, 157], // Datach Ultraman Club */
    [0xf51a7f46, 157], // Datach Yuu Yuu Hakusho */
    [0xe170404c, 159], // SD Gundam Gaiden - Knight Gundam 
    [0x276ac722, 159], // SD Gundam Gaiden - Knight Gundam 
    [0x0cf42e69, 159], // Magical Taruruuto-kun - Fantastic
    [0xdcb972ce, 159], // Magical Taruruuto-kun - Fantastic
    [0xb7f28915, 159], // Magical Taruruuto-kun 2 - Mahou D
    [0x183859d2, 159], // Dragon Ball Z - Kyoushuu! Saiya J
    [0x58152b42, 160], // Pipe 5 (Sachen) */
    [0x1c098942, 162], // Xi You Ji Hou Zhuan (Ch) */
    [0x081caaff, 163], // Commandos (Ch) */
    [0x02c41438, 176], // Xing He Zhan Shi (C) */
    [0x558c0dc3, 178], // Super 2in1 (unl)[!] [mapper unsup
    [0xc68363f6, 180], // Crazy Climber */
    [0x0f05ff0a, 181], // Seicross  (redump) */
    [0x96ce586e, 189], // Street Fighter 2 YOKO */
    [0x555a555e, 191],
    [0x2cc381f6, 191], // Sugoro Quest - Dice no Senshitach
    [0xa145fae6, 192],
    [0xa9115bc1, 192],
    [0x4c7bbb0e, 192],
    [0x98c1cd4b, 192], // Ying Lie Qun Xia Zhuan (Chinese) 
    [0xee810d55, 192], // You Ling Xing Dong (Ch) */
    [0x442f1a29, 192], // Young chivalry */
    [0x637134e8, 193], // Fighting Hero */
    [0xa925226c, 194], // Dai-2-Ji - Super Robot Taisen (As
    [0x7f3dbf1b, 195],
    [0xb616885c, 195], // CHaos WOrld (Ch)*/
    [0x33c5df92, 195],
    [0x1bc0be6c, 195], // Captain Tsubasa Vol 2 - Super Str
    [0xd5224fde, 195], // Crystalis (c) */
    [0xfdec419f, 196], // Street Fighter VI 16 Peoples (Unl
    [0x700705f4, 198],
    [0x9a2cf02c, 198],
    [0xd8b401a7, 198],
    [0x28192599, 198],
    [0x19b9e732, 198],
    [0xdd431ba7, 198], // Tenchi wo kurau 2 (c) */
    [0xd871d3e6, 199], // Dragon Ball Z 2 - Gekishin Freeza
    [0xed481b7c, 199], // Dragon Ball Z Gaiden - Saiya Jin 
    [0x44c20420, 199], // San Guo Zhi 2 (C) */
    [0x4e1c1e3c, 206], // Karnov */
    [0x276237b3, 206], // Karnov */
    [0x7678f1d5, 207], // Fudou Myouou Den */
    [0x07eb2c12, 208], // Street Fighter IV */
    [0xdd8ced31, 209], // Power Rangers 3 */
    [0x063b1151, 209], // Power Rangers 4 */
    [0xdd4d9a62, 209], // Shin Samurai Spirits 2 */
    [0x0c47946d, 210], // Chibi Maruko Chan */
    [0xc247cc80, 210], // Family Circuit '91 */
    [0x6ec51de5, 210], // Famista '92 */
    [0xadffd64f, 210], // Famista '93 */
    [0x429103c9, 210], // Famista '94 */
    [0x81b7f1a8, 210], // Heisei Tensai Bakabon */
    [0x2447e03b, 210], // Top Striker */
    [0x1dc0f740, 210], // Wagyan Land 2 */
    [0xd323b806, 210], // Wagyan Land 3 */
    [0xbd523011, 210], // Dream Master */
    [0x5daae69a, 211], // Aladdin - Return of Jaffar, The (
    [0x1ec1dfeb, 217], // 255-in-1 (Cut version) [p1] */
    [0x046d70cc, 217], // 500-in-1 (Anim Splash, Alt Mapper
    [0x12f86a4d, 217], // 500-in-1 (Static Splash, Alt Mapp
    [0xd09f778d, 217], // 9999999-in-1 (Static Splash, Alt 
    [0x62ef6c79, 232], // Quattro Sports -Aladdin */
    [0x2705eaeb, 234], // Maxi 15 */
    [0x6f12afc5, 235], // Golden Game 150-in-1 */
    [0xfb2b6b10, 241], // Fan Kong Jing Ying (Ch) */
    [0xb5e83c9a, 241], // Xing Ji Zheng Ba (Ch) */
    [0x2537b3e6, 241], // Dance Xtreme - Prima (Unl) */
    [0x11611e89, 241], // Darkseed (Unl) [p1] */
    [0x81a37827, 241], // Darkseed (Unl) [p1][b1] */
    [0xc2730c30, 241], // Deadly Towers (U) [!] */
    [0x368c19a8, 241], // LIKO Study Cartridge 3-in-1 (Unl)
    [0xa21e675c, 241], // Mashou (J) [!] */
    [0x54d98b79, 241], // Titanic 1912 (Unl) */
    [0x6bea1235, 245], // MMC3 cart, but with nobanking app
    [0x345ee51a, 245], // DQ4c */
    [0x57514c6c, 245], // Yong Zhe Dou E Long - Dragon Ques
]
