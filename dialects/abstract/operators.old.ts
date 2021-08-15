import { QueryFactory } from '@lib/factory';
import { SegmentFactory } from '@lib/statement';
import {
  Identifier,
  joinQueryParts,
  Stringable,
  Stringer,
  UnnestSingle,
} from '@lib/util';
import assert from 'assert';

// /**
//  * The abstract class for all operators.
//  *
//  * @abstract
//  */
// export abstract class OperatorFactory<
//   OperandTypes extends Stringable
// > extends QueryFactory {
//   /**
//    * The (unique) human-readable key for the operator.  (e.g. eq -> '='; ne -> '!=' etc.)
//    *
//    * @public @readonly
//    */
//   readonly key: string;
//   public readonly symbol: Symbol;

//   // TODO: Determine if associativity and precedence matter here (at a query builder level)
//   constructor(key: string) {
//     super();
//     this.symbol = Symbol.for(key);
//     this.key = key;
//   }

//   abstract build(...args: Array<OperandTypes>): string;
// }

/*

Notes on operators:
- Different dialects have conflicting precedence and associativity.
- Every operator can have some other operators as  


*/

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

export class BasicOperatorFactory<
  Symbol extends symbol,
  Left extends Stringable = Stringable,
  Right extends Stringable = Left
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

export class LogicalOperatorFactory<
  Symbol extends symbol
> extends OperatorFactory<Symbol> {
  constructor(symbol: Symbol, keyword: string) {
    super(symbol, ` ${keyword} `);
  }
  /**
   * @param conditions The conditions to be joined via the operator of the factory. (e.g. 'AND' / 'OR').
   * @param identifier The identifier (if present) which the
   * !param
   * @returns The operation in SQL.
   *
   * @public
   */
  public build(
    conditions: Array<string | OneOp>,
    identifer?: string | Identifier
  ) {
    if (identifer) {
      assert(
        // @ts-ignore
        conditions.every((condition: string | OneOp): condition is OneOp => {
          if (typeof condition === 'object') return false;
        })
      );
    }

    const segments: Array<string> = [];

    for (const condition of conditions) {
      if (typeof condition === 'object') {
        // Unclear how multiple operations should be handled (e.g. in cases of ordering and such)
        assert(
          Object.getOwnPropertySymbols(condition).filter((sym) =>
            Object.getOwnPropertySymbols(operatorFactories).includes(sym)
          ).length === 1
        );

        segments.push();
      }
    }

    return joinQueryParts(segments, this._operator);
  }
}

export type OneOp = {
  [Symbol in Operator['symbol']]: {
    [_ in Symbol]:
      | Parameters<SymbolToOperatorMap[Symbol]['build']>;
  };
}[Operator['symbol']];

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

// For some reason my syntax highligher breaks if prettier formats the entry of notSimilarTo in ops
// to have the generic part in multiple lines... So this is a hack to keep it working.
type TNotSimilarToSym = typeof notSimilarToSym;

/** @package */
export const comparisonOperatorFactories = {
  eq: new BasicOperatorFactory<typeof eqSym>(eqSym, '='),
  ne: new BasicOperatorFactory<typeof neSym>(neSym, '<>'),
  lt: new BasicOperatorFactory<typeof ltSym>(ltSym, '<'),
  lte: new BasicOperatorFactory<typeof lteSym>(lteSym, '<='),
  gt: new BasicOperatorFactory<typeof gtSym>(gtSym, '>'),
  gte: new BasicOperatorFactory<typeof gteSym>(gteSym, '>='),
  like: new BasicOperatorFactory<typeof likeSym, string | Identifier>(
    likeSym,
    'LIKE'
  ),
  notLike: new BasicOperatorFactory<typeof notLikeSym>(notLikeSym, 'NOT LIKE'),
  in: new BasicOperatorFactory<typeof inSym, Stringable, Array<Stringable>>(
    inSym,
    'IN'
  ),
  notIn: new BasicOperatorFactory<
    typeof notInSym,
    Stringable,
    Array<Stringable>
  >(notInSym, 'NOT IN'),
  iLike: new BasicOperatorFactory<typeof iLikeSym, string | Identifier>(
    iLikeSym,
    'ILIKE'
  ),
  notILike: new BasicOperatorFactory<typeof notILikeSym, string | Identifier>(
    notILikeSym,
    'NOT ILIKE'
  ),
  similarTo: new BasicOperatorFactory<typeof similarToSym, string | Identifier>(
    similarToSym,
    'SIMILAR TO'
  ),
  notSimilarTo: new BasicOperatorFactory<TNotSimilarToSym, string | Identifier>(
    notSimilarToSym,
    'NOT SIMILAR TO'
  ),
};

const andSym = Symbol.for('and');
const orSym = Symbol.for('or');

export const logicalOperatorFactories = {
  and: new LogicalOperatorFactory<typeof andSym>(andSym, 'AND'),
  or: new LogicalOperatorFactory<typeof orSym>(orSym, 'AND'),
};

export const operatorFactories = {
  ...comparisonOperatorFactories,
  ...logicalOperatorFactories,
};

type OperatorFactoryMapping = typeof operatorFactories;

const Op = Object.fromEntries(
  Object.entries(operatorFactories).map(([key, operator]) => [
    key,
    operator.symbol,
  ])
) as {
  [k in keyof OperatorFactoryMapping]: OperatorFactoryMapping[k]['symbol'];
};

export type Operator = OperatorFactoryMapping[keyof OperatorFactoryMapping];

export type SymbolToOperatorMap = {
  [k in Operator['symbol']]: Extract<Operator, { symbol: k }>;
};

export const symbolToOperatorMapping = Object.fromEntries(
  Object.values(operatorFactories).map((factory) => [factory.symbol, factory])
) as SymbolToOperatorMap;

export type OperatorInfoUnion = {
  [k in keyof OpSymbolMap]: [
    k,
    OpSymbolMap[k],
    typeof comparisonOperatorFactories[k]
  ];
}[keyof OpSymbolMap];

type ResolverOf<OperatorSymbol extends symbol> = Extract<
  OperatorInfoUnion,
  [any, OperatorSymbol, any]
>[2];

export const OpResolvers: { [k in OperatorInfoUnion[1]]: ResolverOf<k> } =
  Object.entries(Op).map(([key, sym]) => [
    sym,
    comparisonOperatorFactories[
      key as keyof typeof comparisonOperatorFactories
    ],
  ]) as any;

export type OpSymbolMap = typeof Op;

export type OperatorSymbol = OpSymbolMap[keyof OpSymbolMap];
export { Op as AbstractOp };

const blah = Op.eq as typeof Op['eq'];

const eafea = { [Op.eq]: 'blah' } as const;

eafea[Op.eq];

// export const Op= Object.fromEntries(
//   (Object.keys(operatorFactories) as keyof OperatorFactoryMapping).map(
//     (key) => [key , Symbol.for(key)]
//   )
// );

// abstract class BasicComparisonOperator extends

// const ops = [new ComparisonOperatorFactory('eq', '=')];

// export const Op = Object.fromEntries(ops.map((op) => [op.key, op.symbol]));

// export default Op;

// /** @package */
// export const _operatorMapping = Object.fromEntries(
//   ops.map((op) => [op.key, op.symbol])
// );

/** TODO:
 * - aggreagation operators
 * - logical operators. [Op.and]: [a, b, c] should be [a, b, c].join(" AND ") or similar.
 * - implement `where` logic.
 */
