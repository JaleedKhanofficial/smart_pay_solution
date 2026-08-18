export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Accepts `1234512345671` or `12345-1234567-1`, stores `12345-1234567-1`
 * (FR-CUS-02). Anything else is returned untouched so the regex rejects it.
 */
export const normaliseCnic = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;

  const digits = value.replace(/\D/g, '');

  if (digits.length !== 13) return value.trim();

  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

/** Accepts `03001234567`, `0300-1234567` or `+923001234567`; stores `0300-1234567`. */
export const normaliseMobile = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;

  let digits = value.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('92')) {
    digits = `0${digits.slice(2)}`;
  }

  if (digits.length !== 11) return value.trim();

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

export const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;
export const MOBILE_PATTERN = /^03\d{2}-\d{7}$/;

export const CNIC_MESSAGE = 'must be 13 digits, e.g. 12345-1234567-1';
export const MOBILE_MESSAGE =
  'must be a Pakistani mobile number, e.g. 0300-1234567';
