const [smtpConfig, setSmtpConfig] = useState({
  host: '',
  port: '',
  username: '',
  password: ''
});

const [isSaving, setIsSaving] = useState(false);

const handleInputChange = (e) => {
  const { name, value } = e.target;
  setSmtpConfig(prev => ({
    ...prev,
    [name]: value
  }));
};

const handleSaveConfig = async () => {
  if (isSaving) return;
  try {
    setIsSaving(true);
    const response = await fetch('/api/smtp/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(smtpConfig)
    });

    if (!response.ok) {
      throw new Error('Failed to save SMTP config');
    }

    console.log('SMTP configuration saved successfully');
  } catch (error) {
    console.error('Error saving SMTP config:', error);
  } finally {
    setIsSaving(false);
  }
};

const loadSmtpConfig = async () => {
  try {
    const response = await fetch('/api/smtp/config');
    if (!response.ok) throw new Error('Failed to load SMTP config');

    const data = await response.json();
    setSmtpConfig(data);
  } catch (error) {
    console.error('Error loading SMTP config:', error);
  }
};

useEffect(() => {
  loadSmtpConfig();
}, []);
