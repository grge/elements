import { Token, tokenize } from './tokens'

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

export function parse_variable(tokens:Array<Token>):Variable {
    let token = tokens.shift()
    // token = tokens.shift();
    if (token.type == "Term") {
        return {name: token.name};
    }
}

export function parse_relation_or_definition(tokens:Array<Token>):Relation|Definition {
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
                    if (token.type != "EOF" && token.type != "Dedent") {
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

export function parse_conjunction(tokens:Array<Token>):Conjunction {
    let rels:Array<Relation> = [];
    let defs:Array<Definition> = [];

    while (tokens.length && tokens[0].type != "EOF" && tokens[0].type != "Dedent") {
        if (tokens[0].type == 'Indent') { tokens.pop() }
        var x = parse_relation_or_definition(tokens);

        if((x as Definition).conj) {
            defs.push(x as Definition);
        } else {
            rels.push(x as Relation);
        }
    }
    return {rels: rels, defs: defs}
}

export function parse(source:string):Conjunction {
    return parse_conjunction(tokenize(source))
}