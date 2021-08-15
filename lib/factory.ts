import { Stringer } from './util';

export abstract class QueryFactory {
  /**
   * The underlying value of the stringer used via the factory.
   * This is set via a call to {@link QueryStatementFactory._init}.
   *
   * @private @readonly
   */
  private _stringer?: Stringer;

  /**
   * The stringer for the factory. Used for quoting identifiers, serializing values, etc.
   *
   * @protected @readonly
   */
  protected get stringer(): Stringer {
    if (!this._stringer) {
      throw new Error('stringer accessed before init');
    }

    return this._stringer;
  }

  /**
   * Sets the stringer of a query factory.
   * @param stringer The stringer for the query factory
   */
  protected _init(stringer: Stringer): void {
    this._stringer = stringer;
  }

  /**
   *
   * @param children An array of children which may be QueryFactory instances
   * that may need to be initialized.
   */
  protected _initChildren(children: Array<any>): void {
    for (const child of children) {
      // make sure child._stringer is falsy in case there's ever a recursive statement
      if (child instanceof QueryFactory && !child._stringer) {
        child._init(this.stringer);
      }
    }
  }

  /**
   * The function used to generate the SQL string for this statement.  The last (/ only) argument should be an options object
   * which has keys which are to be directly mapped to {@link QueryStatementFactory._resolvers}.
   *
   * Note that it should use {@link QueryStatementFactory._build} to handle any resolvers / child statements.
   *
   * @param args The arguments required to build the string for the query.
   * @returns The generated string from the statement.
   *
   * @abstract @public
   */
  public abstract build(...args: Array<any>): string;
}
