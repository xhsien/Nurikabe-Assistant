{
  /* ===== game variables ===== */
  const board = Game.currentState.cellStatus;
  const size = Game.currentState.cellStatus.length;
  const task = Game.task;

  // HTML elements
  const boardElement = document.querySelector(".board-back");
  const boardCellsElement = boardElement.childNodes;

  /* ===== utility variables and functions ===== */
  class Component {
    constructor(i, j, cells) {
      // root
      this.i = i;
      this.j = j;
      this.requiredSize = -1;

      this.cells = cells;
    }

    get size() {
      return this.cells.length;
    }
  }

  class Island extends Component {
    constructor(i, j, cells, size) {
      super(i, j, cells);
      this.requiredSize = size;
      this.type = DOT;
    }
  }

  class Stream extends Component {
    constructor(i, j, cells) {
      super(i, j, cells);
      this.type = BLACK;
    }
  }


  const WHITE = 0;
  const BLACK = 1;
  const DOT   = 2;

  const di = [0, 0, -1, 1];
  const dj = [1, -1, 0, 0];

  const IsValidCell = function(i, j) {
    return i >= 0 && i < size && j >= 0 && j < size;
  }

  const TypeOf = function(i, j) {
    if (task[i][j] > 0) {
      return DOT;
    } else {
      return board[i][j];
    }
  }

  const Encode = function(i, j) {
    return i * size + j;
  }

  const Decode = function(code) {
    return [Math.floor(code / size), code % size];
  }

  function* BoardIterator(margin = 0) {
    for (let i = 0; i < size - margin; i++) {
      for (let j = 0; j < size - margin; j++) {
        yield [i, j];
      }
    }
  }

  function* NeighborIterator(i, j) {
    for (let k = 0; k < 4; k++) {
      const ni = i + di[k];
      const nj = j + dj[k];
      if (IsValidCell(ni, nj)) {
        yield [ni, nj];
      }
    }
  }

  function* LocalIterator(i, j, size) {
    for (let x = i; x < i + size; x++) {
      for (let y = j; y < j + size; y++) {
        if (IsValidCell(x, y)) {
          yield [x, y];
        }
      }
    }
  }

  const GetStreamsAndIslands = function() {
    let streams = [];
    let islands = [];

    let visited = [...Array(size)].map(x => Array(size).fill(false));

    const BFS = function(i, j) {
      let cells = [];

      visited[i][j] = true;
      const queue = [[i, j]];
      while (queue.length > 0) {
        const [i, j] = queue.shift();

        cells.push([i, j]);

        for (const [ni, nj] of NeighborIterator(i, j)) {
          if (!visited[ni][nj] && TypeOf(ni, nj) == TypeOf(i, j)) {
            visited[ni][nj] = true;
            queue.push([ni, nj]);
          }
        }
      }

      return cells;
    }

    for (const [i, j] of BoardIterator()) {
      if (visited[i][j]) {
        continue;
      }

      if (board[i][j] == BLACK) {
        streams.push(new Stream(i, j, BFS(i, j, BLACK)));
      } else if (task[i][j] > 0) {
        islands.push(new Island(i, j, BFS(i, j, DOT), task[i][j]));
      }
    }

    return [streams, islands];
  }

  const GetExits = function(component) {
    let exits = [];
    for (const [i, j] of component.cells) {
      for (const [ni, nj] of NeighborIterator(i, j)) {
        if (TypeOf(ni, nj) == WHITE && !exits.includes(Encode(ni, nj))) {
          exits.push(Encode(ni, nj));
        }
      }
    }

    return exits.map(Decode);
  }

  /* ===== strategies ===== */
  const [streams, islands] = GetStreamsAndIslands();

  const ComponentExit = function(components) {
    let updates = [];
    for (const component of components) {
      const exits = GetExits(component);

      if (component.requiredSize != component.size && exits.length == 1) {
        const [i, j] = exits.shift();
        updates.push([i, j, component.type]);
      }
    }

    return updates;
  }

  const CoverIsland = function(islands) {
    let updates = [];
    for (const island of islands) {
      if (island.requiredSize == island.size) {
        for (const [i, j] of GetExits(island)) {
          updates.push([i, j, BLACK]);
        }
      }
    }

    return updates;
  }

  const CoverCorner = function(board) {
    let updates = [];
    for (const [i, j] of BoardIterator(1)) {
      let wi = -1;
      let wj = -1;
      let blackCellCount = 0;
      for (const [ni, nj] of LocalIterator(i, j, 2)) {
        if (TypeOf(ni, nj) == BLACK) {
          blackCellCount++;
        } else if (TypeOf(ni, nj) == WHITE) {
          wi = ni;
          wj = nj;
        }
      }

      if (blackCellCount == 3 && wi != -1) {
        updates.push([wi, wj, DOT]);
      }
    }

    return updates;
  }

  const CoverUnreacables = function(islands) {
    let visited = [...Array(size)].map(x => Array(size).fill(0));

    const BFS = function(i, j, dist, id) {
      const queue = [[i, j, dist]];
      while (queue.length > 0) {
        const [i, j, dist] = queue.shift();

        visited[i][j] = id;

        if (dist == 0) {
          continue;
        }

        for (const [ni, nj] of NeighborIterator(i, j)) {
          if (visited[ni][nj] != id && TypeOf(ni, nj) != BLACK) {
            queue.push([ni, nj, dist - 1]);
          }
        }
      }
    }

    let id = 1;
    for (const island of islands) {
      const distance = island.requiredSize - island.size;
      for (const [i, j] of island.cells) {
        BFS(i, j, distance, id++);
      }
    }

    let updates = [];
    for (const [i, j] of BoardIterator()) {
      if (visited[i][j] == 0 && TypeOf(i, j) == WHITE) {
        updates.push([i, j, BLACK]);
      }
    }

    return updates;
  }

  const CoverBetweenIslands = function(islands) {
    const Distance = function([i1, j1], [i2, j2]) {
      return Math.abs(i1 - i2) + Math.abs(j1 - j2);
    }

    const Between = function([i1, j1], [i2, j2]) {
      if (i1 == i2) {
        return [[i1, (j1 + j2) / 2]];
      } else if (j1 == j2) {
        return [[(i1 + i2) / 2, j1]];
      } else {
        return [[i1, j2], [i2, j1]];
      }
    }

    let n = islands.length;

    let updates = [];
    for (let x = 0; x < n; x++) {
      for (let y = x + 1; y < n; y++) {
        const island1 = islands[x];
        const island2 = islands[y];

        for (const cell1 of island1.cells) {
          for (const cell2 of island2.cells) {
            if (Distance(cell1, cell2) == 2) {
              const blacks = Between(cell1, cell2);
              for (const [i, j] of blacks) {
                if (TypeOf(i, j) != BLACK) {
                  updates.push([i, j, BLACK]);
                }
              }
            }
          }
        }
      }
    }

    return updates;
  }

  /* ===== Main ===== */
  const ColorCell = function(i, j, color) {
    const cell = boardCellsElement[Encode(i, j)];

    cell.style.backgroundColor = color;
    cell.style.border = "1px solid " + color;
  }

  const ColorStreams = function(streams) {
    const colors = ["#4aac8b",
                    "#8b64d1",
                    "#5cab47",
                    "#be62b1",
                    "#b9a432",
                    "#6c8bcb",
                    "#ce632f",
                    "#c75980",
                    "#98894c",
                    "#cd5956"];

    let idx = 0;
    for (const stream of streams) {
      if (stream.size < 5) {
        continue;
      }

      const color = colors[idx++];
      for (const [i, j] of stream.cells) {
        ColorCell(i, j, color);
      }
    }
  }


  const ApplyStrategies = function() {
    let streams, islands;
    while (true) {
      [streams, islands] = GetStreamsAndIslands();

      let updates = [];
      updates = updates.concat(ComponentExit(streams));
      updates = updates.concat(ComponentExit(islands));
      updates = updates.concat(CoverIsland(islands));
      updates = updates.concat(CoverCorner(board));
      updates = updates.concat(CoverUnreacables(islands));
      updates = updates.concat(CoverBetweenIslands(islands));

      if (updates.length == 0) {
        break;
      }

      console.log(updates);

      for (const [i, j, type] of updates) {
        board[i][j] = type;
      }
    }

    Game.drawCurrentState();
    ColorStreams(streams);
    Game.storeCurrentState();
  }

  for (const island of islands) {
    if (island.requiredSize == 1) {
      for (const [ni, nj] of NeighborIterator(island.i, island.j)) {
        board[ni][nj] = BLACK;
      }
    }
  }

  ApplyStrategies();

  boardElement.addEventListener("click", () => {
    ApplyStrategies();
  });
}