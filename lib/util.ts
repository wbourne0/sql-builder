/** @package */
export type Falsy = 0 | '' | false | null | undefined;

/** @package */
export type UnnestSingle<Args extends Array<any>> = Exclude<
  Args,
  undefined
>['length'] extends 1
  ? Args[0]
  : Args;

export function quoteTarget(target: string) {
  return `"${target}"`;
}

/**
 * Joins parts of an SQL query via `' `'.  Ignores falsy values.
 * @param parts The parts which should be joined.
 * @returns Each truthy value of parts joined by ' '.  Falsy values in parts are ignored.
 *
 * @example
 * // Returns `SELECT DISTINCT column FROM table`
 * joinQueryParts(['SELECT', 'DISTINCT', 'column FROM table'])
 *
 * @example
 * // Returns `SELECT column FROM table`
 * joinQueryParts(['SELECT', false && 'DISTINCT', 'column FROM table'])
 */
export function joinQueryParts(
  parts: Array<string | Falsy>,
  seperator: string = ' '
): string {
  return parts.filter((i): i is string => !!i).join(seperator);
}

/**
 * A literal SQL string which will be inserted DIRECTLY into any query.
 *
 * It will *NOT* be escaped, so make sure that all literal values are safe.
 */
export class Literal {
  /**
   * @readonly The string the literal represents.
   */
  readonly str: string;

  constructor(str: string) {
    this.str = str;
  }
}

/**
 * A value representing an SQL identifier - such as a table or a reference to a tables column.
 *
 * @example
 * // Represents column "username" of table "users"
 * new Identifier(['users', 'username'])
 *
 * @example
 * // Represents table "users"
 * new Identifier('users')
 */
export class Identifier {
  /**
   * The segments to the identifier (e.g. ['myTable', 'myColumn'])
   * @readonly
   */
  readonly segments: Array<string>;

  constructor(segments: string | Array<string>) {
    this.segments = Array.isArray(segments) ? segments : [segments];
  }
}

/**
 * A union of the types which a {@link Stringer} can format for an SQL query.
 */
export type Stringable =
  | Date
  | string
  | number
  | boolean
  | null
  | Literal
  | Identifier
  | Array<Stringable>;

export abstract class Stringer {
  /**
   * The escape for quote characters in strings.
   *
   * @example
   * // For postgres
   * _quoteEscape = "''";
   *
   * @protected @abstract @readonly
   */
  protected abstract readonly _quoteEscape: string;
  /**
   * The character used to signify a constant
   * value (for the types which should be quoted - eg timestamps and strings)
   *
   * @example
   * // For postgres
   * _quoteConstantCharacter = "'";
   *
   * @protected @abstract @readonly
   */
  protected abstract readonly _quoteConstantCharacter: string;
  /**
   * The character used to signify a constant
   *  value (for the types which should be quoted - eg timestamps and strings)
   *
   * @example
   * // For postgres
   * _quoteIdentifierCharacter = '"';
   *
   * @protected @abstract @readonly
   */
  protected abstract readonly _quoteIdentifierCharacter: string;
  /**
   * The seperator charactor for table/column name seperators.
   *
   * @example
   * // For postgres ("table"."column")
   * _quoteIdentifierCharacter = '.';
   *
   * @protected @abstract @readonly
   */
  protected abstract readonly _identifierSeperator: string;

  /**
   * @protected escapes an string for usage in SQL.
   * @param str The string which should be escaped
   * @returns The string with all {@link Stringer._quoteConstantCharacter} characters
   * replaced with {@link Stringer._quoteEscape}.
   *
   * @protected
   */
  protected _escape(str: string): string {
    return str.replace(this._quoteConstantCharacter, this._quoteEscape);
  }

  /**
   * The function used to quote a string constant (such as 'abc').
   * This uses {@link Stringer._escape} to escape the string then adds the
   * {@link Stringer._quoteConstantCharacter} value to the start and end of the escaped string.
   *
   * @param str The string which should be quoted.
   * @returns The string (quoted and escaped)
   *
   * @protected
   */
  protected _quoteConstant(str: string): string {
    return (
      this._quoteConstantCharacter +
      this._escape(str) +
      this._quoteConstantCharacter
    );
  }

  constructor() {
    // Bind all functions of this to this for use in `map` and such.
    for (const key in this) {
      const value = this[key];
      if (typeof value === 'function') {
        this[key as keyof this] = value.bind(this);
      }
    }
  }

  /**
   * The function used to serialize a string constant.
   * @param str The value of the string constant
   * @returns The SQL-ready version of the string constant.
   *
   * @protected
   */
  protected _serializeString(str: string): string {
    return this._quoteConstant(str);
  }

  /**
   * The function used to serialize a number constant.
   * @param num The number which is to be serialized
   * @returns The SQL-ready value of the number constant
   *
   * @protected
   */
  protected _serializeNumber(num: number): string {
    return num.toString();
  }

  /**
   * Serializes a boolean into a SQL-ready string.
   * @param bool The value of the boolean
   * @returns The SQL-ready string representing the boolean
   *
   * @protected
   */
  protected _serializeBoolean(bool: boolean): string {
    return bool ? 'TRUE' : 'FALSE';
  }

  public quoteIdentifier(identifier: string | Identifier): string {
    if (identifier instanceof Identifier) {
      return identifier.segments
        .map(this.quoteIdentifier)
        .join(this._identifierSeperator);
    }

    return (
      this._quoteIdentifierCharacter +
      identifier +
      this._quoteIdentifierCharacter
    );
  }

  /**
   * Returns whether a value is true or not
   * @param value
   * @returns boolean
   */
  public isStringable(value: any): value is Stringable {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value instanceof Date ||
      value instanceof Identifier ||
      value instanceof Literal ||
      (Array.isArray(value) && value.every(this.isStringable))
    );
  }

  /**
   * Formats a value into an SQL-ready string.
   * Bound to `this` and therefore safe to reference directly, useful for Array.map and such.
   *
   * @param value The stringable value which should be formatted into an SQL-ready value.
   * @returns The SQL-ready string representing `value`.
   *
   * @example
   * // Quote a list of identifiers then join them with `,`
   * identifiers.map(stringer.stringify).join(', ');
   *
   * @example
   * // Quotes and escapes a string (for postgres in this case)
   * const str = " ';DROP TABLE users;";
   *
   * const stringified = stringer.stringify(str)
   *
   * console.log(stringified); // "' '';DROP TABLE users;'"
   *
   * @public
   */
  public stringify(value: Stringable): string {
    if (value instanceof Literal) {
      return value.str;
    } else if (value instanceof Identifier) {
      return this.quoteIdentifier(value);
    } else if (value instanceof Date) {
      return this._quoteConstant(value.toISOString());
    } else if (Array.isArray(value)) {
      return '(' + value.map(this.stringify.bind(this)).join(', ') + ')';
    }

    if (value === null) {
      return 'NULL';
    }

    switch (typeof value) {
      case 'string':
        return this._serializeString(value);
      case 'number':
        return this._serializeNumber(value);
      case 'boolean':
        return value ? 'TRUE' : 'FALSE';
    }
  }
}

export class TmpStringer extends Stringer {
  _quoteEscape = "''";
  _quoteConstantCharacter = "'";
  _quoteIdentifierCharacter = '"';
  _identifierSeperator = '.';
}
