import assert from 'assert';
import { QueryFactory } from './factory';
import { Falsy, joinQueryParts, Stringer, UnnestSingle } from './util';

type QueryStatementResolvers<Order extends Readonly<Array<string>>> = {
  [field in Order[number]]: QueryStatementResolver;
};

type Params<T extends QueryStatementResolver> =
  T extends QueryStatementResolver<infer Args> ? UnnestSingle<Args> : never;

export type OptionsFor<
  Statement extends QueryStatementFactory<
    Readonly<Array<string>>,
    Readonly<Array<string>>
  >
> = {
  [k in Statement['_order'][number]]?: Params<Statement['_resolvers'][k]>;
} &
  {
    [k in Statement['_required'][number]]: Params<Statement['_resolvers'][k]>;
  };

type QueryStatementResolver<Args extends Array<any> = Array<any>> =
  | ((...args: Args) => string)
  | QueryFactory;

/**
 * The abstract class for any type of SQL statement.
 *
 * @abstract
 */
export abstract class QueryStatementFactory<
  Required extends Readonly<Array<string>>,
  Order extends Readonly<Array<string>>
> extends QueryFactory {
  /**
   * Required options for {@link QueryStatementFactory.build}.
   * Note that all required options need to be be in {@link QueryStatementFactory._order},
   * otherwise the factory won't know where to position the statements.
   *
   * @example
   * // Requires 'from' to be a keyof options.
   * // (the as const is a handy way to make the type show up as its constant value rather than Array<string>)
   * _required = ['from'] as const;
   *
   * @abstract @readonly @protected
   */
  abstract readonly _required: Readonly<Required>;
  /**
   * The order in which the options are placed in the query.
   *
   * @example
   * // Ensures that `FROM` is always  the first statement and `order` will always come before `limit` (if present).
   * // (if `order` isn't present `limit` would come directly after `from`.)
   * _order = ['from', 'order', 'limit'] as const;
   *
   * @abstract @readonly @protected
   */
  abstract readonly _order: Readonly<Order>;
  /**
   * The "resolvers" used to build strings for child statements.
   *
   * @abstract @readonly @protected
   */
  abstract readonly _resolvers: QueryStatementResolvers<Order>;

  /**
   * `_init` is used to set the stringer for the factory and (recursively)
   * the stringers for any child factories / statements.
   *
   * @param stringer The stringer for the factory.
   *
   * @protected
   */
  protected _init(stringer: Stringer) {
    super._init(stringer);

    // hack since for some reason QueryStatementFactory can't see protected attributes of other QueryFactory instances
    // despite being an instance of QueryFactory itself. 
    this._initChildren(Object.values(this._resolvers))
  }

  /**
   * @param prefix The start of the final string for the current statement, e.g. `SELECT a, b`. Can also be an array
   * of segments for {@link joinQueryParts}.
   * @param options The options for sub-statments - in the form of { [resolver name]: resolver args }
   * @returns The full string for this statement, after joinging all resolvers with the prefix.
   *
   * @example
   * // For a select query
   * this._build(
   *   ['SELECT', 'DISTINCT', 'columnA, columnB, columnC' ],
   *   { from: 'myTable' },
   * );
   *
   * @protected
   */
  protected _build(
    prefix: string | Array<string | Falsy>,
    options: OptionsFor<this>
  ): string {
    for (const requiredStatement of this._required) {
      assert(
        requiredStatement in options,
        `expected ${requiredStatement} to be in options.`
      );
    }

    for (const statement of Object.keys(options)) {
      assert(this._order.includes(statement), `unexpected field: ${statement}`);
    }

    const querySegments: Array<Array<string | Falsy> | string> = [prefix];

    // make sure to add items in order - otherwise breaking syntax might come up (e.g. `SELECT "a", "b" LIMIT 5 FROM "abc"`)
    for (const targetName of this._order.filter((k) => k in options) as Array<
      keyof OptionsFor<this>
    >) {
      const statementResolver = this._resolvers[targetName];

      const statementArguments =
        (statementResolver as Function).length === 1
          ? ([options[targetName]] as Params<typeof statementResolver>)
          : (options[targetName] as Params<typeof statementResolver>);

      if (statementResolver instanceof QueryFactory) {
        querySegments.push(statementResolver.build(...statementArguments));
      } else {
        querySegments.push(statementResolver(...statementArguments));
      }
    }

    return joinQueryParts(querySegments.flat()) + ';';
  }
}

/**
 * A hack since TS doesn't allow an interface to see protected fields meaning that the typing needs to think that
 * {@link QueryStatementFactory._required}, {@link QueryStatementFactory._order}, and {@link QueryStatementFactory._resolvers }
 * are public, even though they should be treated as protected.
 */
export interface SegmentFactory<Args extends Array<any>> {
  build(...args: Args): string;
}
