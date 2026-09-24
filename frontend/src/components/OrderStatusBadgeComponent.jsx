export default function OrderStatusBadgeComponent({ status }) {
  let backgroundColor = '#e0e0e0';
  let color = '#333';
  
  switch (status) {
    case 'CREATED':
    case 'PENDING':
      backgroundColor = '#fff3cd';
      color = '#856404';
      break;
    case 'ACCEPTED':
    case 'IN_PROGRESS':
      backgroundColor = '#cce5ff';
      color = '#004085';
      break;
    case 'SHIPPED':
    case 'EN_CAMINO':
      backgroundColor = '#d1ecf1';
      color = '#0c5460';
      break;
    case 'DELIVERED':
      backgroundColor = '#d4edda';
      color = '#155724';
      break;
    case 'CANCELLED':
      backgroundColor = '#f8d7da';
      color = '#721c24';
      break;
    default:
      break;
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.85rem',
      fontWeight: 'bold',
      backgroundColor,
      color
    }}>
      {status}
    </span>
  );
}
