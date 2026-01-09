import Cluster from '../models/Cluster.js';
import DictionaryItem from '../models/DictionaryItem.js';

export const checkClusterCanBeActivated = async (clusterId) => {
  const printersCount = await Cluster.getPrintersCount(clusterId);
  return printersCount > 0;
};

export const updateClusterStateBasedOnPrinters = async (clusterId) => {
  const availableCount = await Cluster.getAvailablePrintersCount(clusterId);
  if (availableCount === 0) {
    const cluster = await Cluster.findById(clusterId);
    if (cluster && cluster.state === 'active') {
      await Cluster.update(clusterId, { state: 'inactive' }, cluster.userId);
      return true; // Состояние было изменено
    }
  }
  return false; // Состояние не изменилось
};

export const validateLocationHierarchy = async (regionId, cityId, metroId) => {
  // Проверяем регион
  const regionDict = await DictionaryItem.findById(regionId);
  if (!regionDict) {
    return { valid: false, error: 'Region not found' };
  }

  // Проверяем город
  const cityDict = await DictionaryItem.findById(cityId);
  if (!cityDict) {
    return { valid: false, error: 'City not found' };
  }
  if (cityDict.parentId !== regionId) {
    return { valid: false, error: 'City does not belong to the selected region' };
  }

  // Проверяем метро, если указано
  if (metroId) {
    const metroDict = await DictionaryItem.findById(metroId);
    if (!metroDict) {
      return { valid: false, error: 'Metro station not found' };
    }
    if (metroDict.parentId !== cityId) {
      return { valid: false, error: 'Metro station does not belong to the selected city' };
    }
  }

  return { valid: true };
};


