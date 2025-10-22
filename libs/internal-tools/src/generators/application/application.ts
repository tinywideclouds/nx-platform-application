import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  Tree,
  offsetFromRoot,
} from '@nx/devkit';
import * as path from 'path';
import { ApplicationGeneratorSchema } from './schema';

export async function applicationGenerator(
  tree: Tree,
  options: ApplicationGeneratorSchema
) {
  // Use path.join to combine the route, optional path, and name
  const projectRoot = path.join(options.root, options.path, options.name);

  const templateOptions = {
    ...options,
    name: options.name,
    offsetFromRoot: offsetFromRoot(projectRoot),
    projectRoot: projectRoot,
  };

  addProjectConfiguration(tree, options.name, {
    root: projectRoot,
    projectType: 'application',
    sourceRoot: `${projectRoot}/src`,
    targets: {},
  });

  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, templateOptions);

  await formatFiles(tree);
}

export default applicationGenerator;
