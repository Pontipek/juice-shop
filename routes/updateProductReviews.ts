import challengeUtils = require('../lib/challengeUtils');
import { type Request, type Response, type NextFunction } from 'express';
import * as db from '../data/mongodb';
import { challenges } from '../data/datacache';
const security = require('../lib/insecurity');

module.exports = function productReviews() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate if the user is authenticated
    const user = security.authenticatedUsers.from(req);
    if (!user || !user.data.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reviewId = req.body.id;
    const reviewMessage = req.body.message;

    // Fetch the review first to ensure user owns it
    db.reviewsCollection.findOne({ _id: reviewId })
      .then((review) => {
        if (!review) {
          return res.status(404).json({ error: 'Review not found' });
        }
        if (review.author !== user.data.email) {
          return res.status(403).json({ error: 'Forbidden: You are not the author of this review' });
        }

        // Perform update without modifying the author field
        return db.reviewsCollection.update(
          { _id: reviewId, author: user.data.email },
          { $set: { message: reviewMessage } },
          { multi: false }  // Update a single document
        ).then(
          (result) => {
            challengeUtils.solveIf(challenges.noSqlReviewsChallenge, () => { return result.modified > 1 });
            challengeUtils.solveIf(challenges.forgedReviewChallenge, () => { return result.modified === 1 });
            res.json(result);
          },
          (err) => {
            res.status(500).json(err);
          }
        );
      })
      .catch((err) => {
        console.error('Error fetching review:', err);
        res.status(500).json({ error: 'Failed to fetch review' });
      });
  };
};