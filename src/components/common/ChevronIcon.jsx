import PropTypes from 'prop-types';

const ChevronIcon = ({ className = "" }) => (
  <svg className={`w-4 h-4 transition-transform details-chevron ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

ChevronIcon.propTypes = {
  className: PropTypes.string,
};

export default ChevronIcon;
