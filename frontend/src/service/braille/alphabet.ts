interface ISymbol {
  symbol: string
  dots: number[]
}

class Alphabet {
  symbols: ISymbol[]

  getSymbols(): ISymbol[] {
    return this.symbols
  }
}

export class AlphabetEn extends Alphabet {

  symbols: ISymbol[] = [
    {symbol: "A", dots: [1, 0, 0, 0, 0, 0]},
    {symbol: "B", dots: [1, 1, 0, 0, 0, 0]},
    {symbol: "C", dots: [1, 0, 0, 1, 0, 0]},
    {symbol: "D", dots: [1, 0, 0, 1, 1, 0]},
    {symbol: "E", dots: [1, 0, 0, 0, 1, 0]},
    {symbol: "F", dots: [1, 1, 0, 1, 0, 0]},
    {symbol: "G", dots: [1, 1, 0, 1, 1, 0]},
    {symbol: "H", dots: [1, 1, 0, 0, 1, 0]},
    {symbol: "I", dots: [0, 1, 0, 1, 0, 0]},
    {symbol: "J", dots: [0, 1, 0, 1, 1, 0]},
    {symbol: "K", dots: [1, 0, 1, 0, 0, 0]},
    {symbol: "L", dots: [1, 1, 1, 0, 0, 0]},
    {symbol: "M", dots: [1, 0, 1, 1, 0, 0]},
    {symbol: "N", dots: [1, 0, 1, 1, 1, 0]},
    {symbol: "O", dots: [1, 0, 1, 0, 1, 0]},
    {symbol: "P", dots: [1, 1, 1, 1, 0, 0]},
    {symbol: "Q", dots: [1, 1, 1, 1, 1, 0]},
    {symbol: "R", dots: [1, 1, 1, 0, 1, 0]},
    {symbol: "S", dots: [0, 1, 1, 1, 0, 0]},
    {symbol: "T", dots: [0, 1, 1, 1, 1, 0]},
    {symbol: "U", dots: [1, 0, 1, 0, 0, 1]},
    {symbol: "V", dots: [1, 1, 1, 0, 0, 1]},
    {symbol: "W", dots: [0, 1, 0, 1, 1, 1]},
    {symbol: "X", dots: [1, 0, 1, 1, 0, 1]},
    {symbol: "Y", dots: [1, 0, 1, 1, 1, 1]},
    {symbol: "Z", dots: [1, 0, 1, 0, 1, 1]},
    {symbol: "#", dots: [0, 0, 1, 1, 1, 1]},
    {symbol: "0", dots: [0, 1, 0, 1, 1, 0]},
    {symbol: "1", dots: [1, 0, 0, 0, 0, 0]},
    {symbol: "2", dots: [1, 1, 0, 0, 0, 0]},
    {symbol: "3", dots: [1, 0, 0, 1, 0, 0]},
    {symbol: "4", dots: [1, 0, 0, 1, 1, 0]},
    {symbol: "5", dots: [1, 0, 0, 0, 1, 0]},
    {symbol: "6", dots: [1, 1, 0, 1, 0, 0]},
    {symbol: "7", dots: [1, 1, 0, 1, 1, 0]},
    {symbol: "8", dots: [1, 1, 0, 0, 1, 0]},
    {symbol: "9", dots: [0, 1, 0, 1, 0, 0]},
  ]
}

export class AlphabetRu extends Alphabet {
  symbols: ISymbol[] = [
    {symbol: "А", dots: [1,0,0,0,0,0]},
    {symbol: "Б", dots: [1,1,0,0,0,0]},
    {symbol: "В", dots: [0,1,0,1,1,1]},
    {symbol: "Г", dots: [1,1,0,1,1,0]},
    {symbol: "Д", dots: [1,0,0,1,1,0]},
    {symbol: "Е", dots: [1,0,0,0,1,0]},
    {symbol: "Ё", dots: [1,0,0,0,0,1]},
    {symbol: "Ж", dots: [0,1,0,1,1,0]},
    {symbol: "З", dots: [1,0,1,0,1,1]},
    {symbol: "И", dots: [0,1,0,1,0,0]},
    {symbol: "Й", dots: [1,1,1,1,0,1]},
    {symbol: "К", dots: [1,0,1,0,0,0]},
    {symbol: "Л", dots: [1,1,1,0,0,0]},
    {symbol: "М", dots: [1,0,1,1,0,0]},
    {symbol: "Н", dots: [1,0,1,1,1,0]},
    {symbol: "О", dots: [1,0,1,0,1,0]},
    {symbol: "П", dots: []},
    {symbol: "Р", dots: []},
    {symbol: "С", dots: []},
    {symbol: "Т", dots: []},
    {symbol: "У", dots: []},
    {symbol: "Ф", dots: []},
    {symbol: "Х", dots: []},
    {symbol: "Ц", dots: []},
    {symbol: "Ч", dots: []},
    {symbol: "Ш", dots: []},
    {symbol: "Щ", dots: []},
    {symbol: "Ь", dots: []},
    {symbol: "Ы", dots: []},
    {symbol: "Ъ", dots: []},
    {symbol: "Э", dots: []},
    {symbol: "Ю", dots: []},
    {symbol: "Я", dots: []},
  ]
}
