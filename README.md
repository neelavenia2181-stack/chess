# ♞ Synthwave Chess

A modern chess game with a synthwave aesthetic, built with vanilla JavaScript and the [chess.js](https://github.com/jhlywa/chess.js) library.
> Note: the AI bot implementation still in progress

## Features

- **Full Chess Game**: Complete chess rules implementation including castling, en passant, and pawn promotion
- **Intuitive UI**: Click-to-select interface for moving pieces
- **Move Validation**: Legal move highlighting and validation
- **Move History**: Keep track of all moves made during the game
- **Undo/Redo**: Rewind and replay moves
- **Board Flipping**: Flip the board perspective
- **Captured Pieces Display**: Visual representation of captured pieces
- **Game Status**: Real-time status display (check, checkmate, stalemate)
- **Synthwave Aesthetic**: Vibrant neon-inspired design with modern typography

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone or download the repository
2. Open `index.html` in your web browser
3. Start playing!

## How to Play

1. **Start a Game**: Click the "New Game" button to begin
2. **Select a Piece**: Click on a piece to select it (legal moves will be highlighted)
3. **Move the Piece**: Click on a highlighted square to move
4. **Special Moves**: The game automatically handles castling, en passant, and pawn promotion
5. **Undo/Redo**: Use the undo and redo buttons to navigate move history
6. **Flip Board**: Toggle the board orientation with the flip button
7. **Toggle Hints**: Show/hide legal move indicators

## Project Structure

```
├── index.html          # Main HTML structure
├── style.css          # Synthwave styling and layout
├── script.js          # Game logic and UI control
├── test.js            # Unit tests
├── test-dimensions.js # Dimension tests
└── README.md          # This file
```

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with custom properties
- **JavaScript (ES6+)**: Game logic and DOM manipulation
- **chess.js**: Chess game logic library

## Browser Support

Works on all modern browsers that support ES6 JavaScript:
- Chrome 51+
- Firefox 54+
- Safari 10+
- Edge 15+

## Testing

The project includes test files for validation:
- `test.js` - Unit tests
- `test-dimensions.js` - Dimension/layout tests

## License

This project is open source and available under the MIT License.

## Credits

- Chess game logic powered by [chess.js](https://github.com/jhlywa/chess.js)
- Fonts: Orbitron, JetBrains Mono, Space Grotesk (Google Fonts)

---

**Enjoy playing chess with style!** ♟
