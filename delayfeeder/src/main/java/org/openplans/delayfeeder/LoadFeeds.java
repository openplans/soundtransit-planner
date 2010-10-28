/* Copyright 2010, OpenPlans
 
 This program is free software: you can redistribute it and/or
 modify it under the terms of the GNU General Public License
 as published by the Free Software Foundation, either version 3 of
 the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>. */

package org.openplans.delayfeeder;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.GregorianCalendar;
import java.util.List;

import org.hibernate.HibernateException;
import org.hibernate.Query;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.Transaction;
import org.openplans.delayfeeder.feed.RouteFeed;
import org.springframework.beans.factory.xml.XmlBeanDefinitionReader;
import org.springframework.context.support.GenericApplicationContext;

public class LoadFeeds {

	public static void main(String args[]) throws HibernateException, IOException {
		if (args.length != 1) {
			System.out.println("expected one argument: the path to a csv of agency,route,url");
		}
        GenericApplicationContext context = new GenericApplicationContext();
        XmlBeanDefinitionReader xmlReader = new XmlBeanDefinitionReader(context);
        xmlReader.loadBeanDefinitions("org/openplans/delayfeeder/application-context.xml");
        xmlReader.loadBeanDefinitions("data-sources.xml");

        SessionFactory sessionFactory = (SessionFactory) context.getBean("sessionFactory");

        Session session = sessionFactory.getCurrentSession();
        Transaction tx = session.beginTransaction();

        FileReader fileReader = new FileReader(new File(args[0]));
        BufferedReader bufferedReader = new BufferedReader(fileReader);
        while(bufferedReader.ready()) {
        	String line = bufferedReader.readLine().trim();
        	if (line.startsWith("#")) {
        		continue;
        	}
        	if (line.length() < 3) {
        		//blank or otherwise broken line
        		continue;
        	}
        
        	String[] parts = line.split(",");
        	String agency = parts[0];
        	String route = parts[1];
        	String url = parts[2];
        	Query query = session.createQuery("from RouteFeed where agency = :agency and route = :route");
     		query.setParameter("agency", agency);
     		query.setParameter("route", route);
     		List list = query.list();
     		RouteFeed feed;
     		if (list.size() == 0) {
     			feed = new RouteFeed();
     			feed.agency = agency;
     			feed.route = route;
     			feed.lastEntry = new GregorianCalendar();
     		} else {
     			feed = (RouteFeed) list.get(0);
     		}
     		if (!url.equals(feed.url)) { 
     			feed.url = url;
     			feed.lastEntry.setTimeInMillis(0);
     		}
            session.saveOrUpdate(feed);
        }
        tx.commit();
	}
}
