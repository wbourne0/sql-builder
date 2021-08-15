// const baseOperators = {

import { QueryFactory } from '@lib/factory';
import {
  Identifier,
  joinQueryParts,
  Literal,
  Stringable,
  Stringer,
  TmpStringer,
  UnnestSingle,
} from '@lib/util';
import { assert } from 'console';

export abstract class OperatorFactory<
  Symbol extends symbol
> extends QueryFactory {
  /** @protected @readonly */
  protected readonly _operator: string;
  /** @package @readonly */
  readonly symbol: Symbol;

  constructor(symbol: Symbol, operator: string) {
    super();
    this.symbol = symbol;
    this._operator = operator;
  }
}

const eqSym = Symbol.for('eq');
const inSym = Symbol.for('in');
const neSym = Symbol.for('ne');
const ltSym = Symbol.for('lt');
const lteSym = Symbol.for('lte');
const gtSym = Symbol.for('gt');
const gteSym = Symbol.for('gte');
const likeSym = Symbol.for('like');
const notLikeSym = Symbol.for('notLike');
const notInSym = Symbol.for('notIn');
const iLikeSym = Symbol.for('iLike');
const notILikeSym = Symbol.for('notILike');
const similarToSym = Symbol.for('similarTo');
const notSimilarToSym = Symbol.for('notSimilarTo');
const andSym = Symbol.for('and');
const orSym = Symbol.for('or');
const notSym = Symbol.for('not');

type OperatorSymbol =
  | typeof eqSym
  | typeof inSym
  | typeof neSym
  | typeof ltSym
  | typeof lteSym
  | typeof gtSym
  | typeof gteSym
  | typeof likeSym
  | typeof notLikeSym
  | typeof notInSym
  | typeof iLikeSym
  | typeof notILikeSym
  | typeof similarToSym
  | typeof notSimilarToSym
  | typeof andSym
  | typeof orSym;

type BothOrRight<T> = T extends [left: any, right: any] ? T | T[1] : T;

type ParamsFor<
  T extends LogicalOperatorFactory | BasicOperatorFactory<any, any, any>
> = T extends BasicOperatorFactory<any, infer Left, infer Right>
  ? [Left, Right] | Right
  :
      | Parameters<T['build']>[0]['args']
      | [Identifier, Parameters<T['build']>[0]['args']];

type OneOp = {
  [sym in OperatorSymbol]: {
    [_ in sym]: ParamsFor<typeof OperatorResolvers[sym]>;
  };
}[OperatorSymbol];

type MaybeWithIdentifier<Args> = Args | [Identifier, Args];

type ClauseOp = {
  [sym in OperatorSymbol]: {
    [_ in sym]: Parameters<
      typeof OperatorResolvers[sym]['build']
    >[0] extends OperationContext<infer Args, any>
      ? Args
      : never;
  };
}[OperatorSymbol];

const Op = {
  eq: eqSym as typeof eqSym,
  ne: neSym as typeof neSym,
  lt: ltSym as typeof ltSym,
  lte: lteSym as typeof lteSym,
  gt: gtSym as typeof gtSym,
  gte: gteSym as typeof gteSym,
  like: likeSym as typeof likeSym,
  notLike: notLikeSym as typeof notLikeSym,
  in: inSym as typeof inSym,
  notIn: notInSym as typeof notInSym,
  iLike: iLikeSym as typeof iLikeSym,
  notILike: notILikeSym as typeof notILikeSym,
  similarTo: similarToSym as typeof similarToSym,
  notSimilarTo: notSimilarToSym as typeof notSimilarToSym,
  and: andSym as typeof andSym,
  or: orSym as typeof orSym,
  not: notSym as typeof notSym,
};

type OperationContext<ArgsWithIdentifer, ArgsWithoutIdentifier> =
  | {
      identifier: Identifier;
      args: ArgsWithIdentifer;
    }
  | {
      args: ArgsWithoutIdentifier;
    };

type ChildOperationContext<ArgsWithIdentifer, ArgsWithoutIdentifier> = {
  args: ArgsWithIdentifer | ArgsWithoutIdentifier;
};

type Resolver<Args> = (
  args: Args
) => string | (Args extends Array<any> ? (...args: Args) => string : never);

export class BasicOperatorFactory<
  Symbol extends symbol,
  Left extends Stringable,
  Right extends Stringable
> extends OperatorFactory<Symbol> {
  /**
   *
   * @param left The left operand
   * @param right The right operand
   * @returns The operation in SQL.
   *
   * @example
   * // For the `=` operator
   * eq.build("abc", "def"); // -> "'abc' = 'def'"
   *
   * @public
   */
  public build(left: Left, right: Right): string {
    return joinQueryParts([
      this.stringer.stringify(left),
      this._operator,
      this.stringer.stringify(right),
    ]);
  }
}

const operatorSymbols = Object.values(Op);

function getArgumentsFor<Symbol extends OperatorSymbol>(
  symbol: Symbol,
  op: any
): BothOrRight<
  UnnestSingle<Parameters<typeof OperatorResolvers[OperatorSymbol]['build']>>
> {
  return op[symbol];
}

type InverseOneOp = { [_ in typeof Op.not]: OneOp };

export class LogicalOperatorFactory extends QueryFactory {
  private _joiner: ' AND ' | ' OR ';

  constructor(operator: 'AND' | 'OR') {
    super();
    this._joiner = ` ${operator} `;
  }

  public build(
    ctx: OperationContext<
      Array<Stringable | OneOp | InverseOneOp>,
      Array<[Identifier, Stringable | OneOp | InverseOneOp]>
    >
  ): string {
    const identifier = 'identifier' in ctx ? ctx.identifier : undefined;
    const { args } = ctx;
    const parts = [];

    for (let conditionArgs of args) {
      let notModifier = '';

      let childIdentifier = identifier;

      if (
        Array.isArray(conditionArgs) &&
        conditionArgs.length === 2 &&
        conditionArgs[0] instanceof Identifier
      ) {
        [childIdentifier, conditionArgs] = conditionArgs;
      }

      if (
        conditionArgs &&
        typeof conditionArgs === 'object' &&
        Op.not in conditionArgs
      ) {
        notModifier = 'NOT ';
        conditionArgs = (conditionArgs as InverseOneOp)[Op.not];
      }

      if (this.stringer.isStringable(conditionArgs)) {
        if (!childIdentifier) {
          throw new Error(
            'No identifier specified, unable to compare ' + conditionArgs
          );
        }

        parts.push(
          OperatorResolvers[Op.eq].build(childIdentifier, conditionArgs)
        );

        continue;
      }

      const symbols = Object.getOwnPropertySymbols(conditionArgs).filter(
        (sym): sym is OperatorSymbol =>
          operatorSymbols.includes(sym as OperatorSymbol)
      );

      console.log(symbols);

      assert(
        symbols.length === 1,
        'expected exactly one operator per object in and/or list'
      );

      const [symbol] = symbols;

      if (symbol === Op.or || symbol === Op.and) {
        let operatorArgs = getArgumentsFor<typeof Op.or | typeof Op.and>(
          symbol,
          conditionArgs
        );

        let options: Parameters<LogicalOperatorFactory['build']>[0];

        const factory = OperatorResolvers[symbol];

        if (
          Array.isArray(operatorArgs) &&
          operatorArgs.length === 2 &&
          operatorArgs[0] instanceof Identifier
        ) {
          [childIdentifier, operatorArgs] = operatorArgs;
        }

        const cond = factory.build({
          ...(childIdentifier && { identifier: childIdentifier }),
          args: operatorArgs as any,
        });

        parts.push(notModifier + (args.length > 1 ? `(${cond})` : cond));

        continue;
      }

      let operatorArgs = getArgumentsFor(symbol, conditionArgs);

      const factory = OperatorResolvers[symbol];

      if (
        Array.isArray(operatorArgs) &&
        operatorArgs.length === 2 &&
        operatorArgs[0] instanceof Identifier
      ) {
        [childIdentifier, operatorArgs] = operatorArgs;
      }

      parts.push(
        notModifier +
          (childIdentifier
            ? factory.build(childIdentifier, operatorArgs as any)
            : factory.build(...(operatorArgs as [any, any])))
      );
    }

    return joinQueryParts(parts, this._joiner);
  }
}

type ValueCmprArgType = Exclude<Stringable, boolean | null | Array<Stringable>>;
// The operator context for operators like `<`, `>`, `<=`, etc.
type ValueCmprCtx = OperationContext<
  ValueCmprArgType,
  [ValueCmprArgType, ValueCmprArgType]
>;

type InCmprCtx = OperationContext<
  Array<Stringable>,
  [Stringable, Array<Stringable>]
>;

type StringOrSimilar = string | Identifier | Literal;

type NonNullStringable = Exclude<Stringable, null>;
/**
 * A stringable value comparable by > / < / >= / <=
 *
 * @package
 */
type LTGTComparable = Exclude<Stringable, boolean | null | Array<Stringable>>;

class OperatorResolvers {
  static [Op.eq] = new BasicOperatorFactory<
    typeof Op.eq,
    NonNullStringable,
    Stringable
  >(Op.eq, '=');

  static [Op.ne] = new BasicOperatorFactory<
    typeof Op.ne,
    NonNullStringable,
    Stringable
  >(Op.ne, '<>');
  static [Op.in] = new BasicOperatorFactory<
    typeof Op.in,
    Stringable,
    Array<Stringable>
  >(Op.in, 'IN');
  static [Op.notIn] = new BasicOperatorFactory<
    typeof Op.notIn,
    Stringable,
    Stringable
  >(Op.notIn, 'NOT IN');
  static [Op.lt] = new BasicOperatorFactory<
    typeof Op.lt,
    LTGTComparable,
    LTGTComparable
  >(Op.lt, '<');
  static [Op.lte] = new BasicOperatorFactory<
    typeof Op.lte,
    LTGTComparable,
    LTGTComparable
  >(Op.lte, '<=');
  static [Op.gt] = new BasicOperatorFactory<
    typeof Op.gt,
    LTGTComparable,
    LTGTComparable
  >(Op.gt, '>');
  static [Op.gte] = new BasicOperatorFactory<
    typeof Op.gte,
    LTGTComparable,
    LTGTComparable
  >(Op.gte, '>=');
  static [Op.like] = new BasicOperatorFactory<
    typeof Op.like,
    LTGTComparable,
    LTGTComparable
  >(Op.like, 'LIKE');
  static [Op.notLike] = new BasicOperatorFactory<
    typeof Op.notLike,
    StringOrSimilar,
    StringOrSimilar
  >(Op.notLike, 'NOT LIKE');

  static [Op.iLike] = new BasicOperatorFactory<
    typeof Op.iLike,
    StringOrSimilar,
    StringOrSimilar
  >(Op.iLike, 'ILIKE');
  static [Op.notILike] = new BasicOperatorFactory<
    typeof Op.notILike,
    StringOrSimilar,
    StringOrSimilar
  >(Op.notILike, 'NOT ILIKE');
  static [Op.similarTo] = new BasicOperatorFactory<
    typeof Op.similarTo,
    StringOrSimilar,
    StringOrSimilar
  >(Op.similarTo, 'SIMILAR TO');
  static [Op.notSimilarTo] = new BasicOperatorFactory<
    typeof Op.notSimilarTo,
    StringOrSimilar,
    StringOrSimilar
  >(Op.notSimilarTo, 'NOT SIMILAR TO');
  static [Op.and] = new LogicalOperatorFactory('AND');
  static [Op.or] = new LogicalOperatorFactory('OR');
}

Object.getOwnPropertySymbols(OperatorResolvers).forEach(
  (v) => v && OperatorResolvers[v]._init(new TmpStringer())
);

function identifier(
  ...args: ConstructorParameters<typeof Identifier>
): Identifier {
  return new Identifier(...args);
}

console.log(
  OperatorResolvers[Op.and].build({
    args: [
      [identifier('abc'), 'def'],
      [
        identifier(['users', 'username']),
        {
          [Op.or]: [
            {
              [Op.in]: ['joe', 'bob'],
            },
            {
              [Op.and]: [
                { [Op.eq]: [identifier(['users', 'email']), 'abc'] },
                { [Op.not]: { [Op.eq]: 'abc' } },
              ],
            },
            {
              [Op.and]: [
                identifier('users.id'),
                [{ [Op.lte]: 100 }, { [Op.gt]: 0 }],
              ],
            },
          ],
        },
      ],
    ],
  })
);
