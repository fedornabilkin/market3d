import { body } from 'express-validator';
import DictionaryItem from '../../models/DictionaryItem.js';
import Dictionary from '../../models/Dictionary.js';
import Cluster from '../../models/Cluster.js';

export const clusterValidation = [
  body('name')
    .notEmpty()
    .withMessage('Cluster name is required')
    .isString()
    .withMessage('Name must be a string')
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),
  
  body('regionId')
    .notEmpty()
    .withMessage('Region is required')
    .isInt()
    .withMessage('Region ID must be an integer')
    .custom(async (value) => {
      const regionDict = await Dictionary.findByName('regions');
      if (!regionDict) {
        throw new Error('Regions dictionary not found');
      }
      const item = await DictionaryItem.findById(value);
      if (!item || item.dictionaryId !== regionDict.id) {
        throw new Error('Invalid region');
      }
      return true;
    }),
  
  body('cityId')
    .notEmpty()
    .withMessage('City is required')
    .isInt()
    .withMessage('City ID must be an integer')
    .custom(async (value, { req }) => {
      const cityDict = await Dictionary.findByName('cities');
      if (!cityDict) {
        throw new Error('Cities dictionary not found');
      }
      const item = await DictionaryItem.findById(value);
      if (!item || item.dictionaryId !== cityDict.id) {
        throw new Error('Invalid city');
      }
      // Проверяем, что город является дочерним для выбранного региона
      if (req.body.regionId && item.parentId !== parseInt(req.body.regionId)) {
        throw new Error('City must belong to the selected region');
      }
      return true;
    }),
  
  body('metroId')
    .optional()
    .isInt()
    .withMessage('Metro ID must be an integer')
    .custom(async (value, { req }) => {
      if (!value) return true;
      const metroDict = await Dictionary.findByName('metro_stations');
      if (!metroDict) {
        throw new Error('Metro stations dictionary not found');
      }
      const item = await DictionaryItem.findById(value);
      if (!item || item.dictionaryId !== metroDict.id) {
        throw new Error('Invalid metro station');
      }
      // Проверяем, что метро является дочерним для выбранного города
      if (req.body.cityId && item.parentId !== parseInt(req.body.cityId)) {
        throw new Error('Metro station must belong to the selected city');
      }
      return true;
    }),
  
  body('parentClusterId')
    .optional()
    .isInt()
    .withMessage('Parent cluster ID must be an integer')
    .custom(async (value) => {
      if (!value) return true;
      const cluster = await Cluster.findById(value);
      if (!cluster) {
        throw new Error('Parent cluster not found');
      }
      return true;
    }),
  
  body('state')
    .optional()
    .isIn(['draft', 'active', 'inactive', 'archived'])
    .withMessage('Invalid cluster state'),
];


