import { Token } from './tokens'

export interface Definition {
    name: string,
    vars: Array<Variable>,
    conj: Conjunction,
}

export interface Conjunction {
    rels: Array<Relation>,
    defs: Array<Definition>
}

export interface Relation {
    name: string,
    vars: Array<Variable>
}

export interface Variable {
    name: string
}


function parse_variable(tokens:Array<Token>):Variable {
    let token = tokens.shift()
    token = tokens.shift();
    if (token.type == "term") {
        return {name: token.name};
    }
}

function parse_relation_or_definition(tokens:Array<Token>):Relation|Definition {
    let token = tokens.shift();

    switch(token.type) {
        case "Term":
            let name = token.name;
            let vars:Array<Variable> = [];

            while (tokens && tokens[0].type == "Term") {
                vars.push(parse_variable(tokens));
            }

            token = tokens.shift();

            switch(token.type) {
                case "Colon":
                    token = tokens.shift();
                    if (token.type != "Indent" ) {
                        throw "Parse error: Expected indent, got " + token.type
                    };
                    let conj = parse_conjunction(tokens);
                    token = tokens.shift();
                    if (token.type != "eof" && token.type != "dedent") {
                        throw "Parse error: Expected dedent, got " + token.type
                    };
                    return {name: name, vars: vars, conj: conj}
                case "Newline":
                case "EOF":
                    return {name: name, vars: vars}
                default:
                    throw "Parse error: Unexpected token" + token.type;
            }
        default:
            throw "Parse error: Expected Term, got " + token.type;
    }
}


function parse_conjunction(tokens:Array<Token>):Conjunction {
    let rels:Array<Relation> = [];
    let defs:Array<Definition> = [];

    while (tokens.length && tokens[0].type != "EOF" && tokens[0].type != "Dedent") {
        if (tokens[0] == 'indent') { tokens.pop() }
        var x = parse_relation_or_definition(tokens);

        if((x as Definition).conj) {
            defs.push(x as Definition);
        } else {
            rels.push(x as Relation);
        }
    }
    return {rels: rels, defs: defs}
}

export let parse:((tokens:Array<Token>) => Conjunction) = parse_conjunction;